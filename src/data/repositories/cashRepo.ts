import { getDb } from '../db/sqlite';
import { getCurrentLocalDateStr } from '../../shared/utils/dates';
import { EMPTY_CASH_STATE, validateCashDenominations } from '../../features/cash/utils/cashCalculations';

type CashDb = Awaited<ReturnType<typeof getDb>>;

const validateMovementType = (type: string): void => {
    if (type !== 'IN' && type !== 'OUT') throw new Error('El tipo de movimiento de caja no es válido.');
};

// Used inside the same transaction as a new movement, so a late refresh cannot
// reset money just recorded for the new day. Keep the existing daily-reset policy.
const resetCashDay = async (db: CashDb, now = new Date()): Promise<boolean> => {
    const today = getCurrentLocalDateStr(now);
    const lastResetDay = await cashRepo.getCashStateLastResetDay(db);
    if (lastResetDay === today) return false;
    await cashRepo.setCashState(EMPTY_CASH_STATE, db);
    await cashRepo.setCashStateLastResetDay(today, db);
    return true;
};

export interface CashMovement {
    id: number;
    type: 'IN' | 'OUT';
    total_cents: number;
    denominations_json: string; // JSON Record<string, number>
    note?: string;
    created_at: string;
}

export interface CashState {
    denoms: Record<string, number>;
    updatedAt: string;
}

export const cashRepo = {
    async getCashState(executor?: CashDb): Promise<CashState> {
        const db = executor ?? await getDb();
        const result = await db.getAllAsync<{ denominations_json: string; updated_at: string }>(
            'SELECT denominations_json, updated_at FROM cash_state WHERE id = 1'
        );
        if (result.length === 0) {
            throw new Error('No se encontró el saldo guardado de caja. No se modificó ningún dato.');
        }
        try {
            const denoms = JSON.parse(result[0].denominations_json);
            validateCashDenominations(denoms);
            return {
                denoms,
                updatedAt: result[0].updated_at
            };
        } catch (e) {
            throw new Error('El saldo guardado de caja no es válido. No se modificó ningún dato.');
        }
    },

    async setCashState(denoms: Record<string, number>, executor?: CashDb): Promise<void> {
        validateCashDenominations(denoms);
        const db = executor ?? await getDb();
        await db.runAsync(
            'UPDATE cash_state SET denominations_json = ?, updated_at = ? WHERE id = 1',
            [JSON.stringify(denoms), new Date().toISOString()]
        );
    },

    async addCashMovement(type: 'IN' | 'OUT', totalCents: number, denomsDelta: Record<string, number>, note?: string, executor?: CashDb, createdAt = new Date()): Promise<void> {
        validateMovementType(type);
        if (validateCashDenominations(denomsDelta) !== totalCents || totalCents <= 0) {
            throw new Error('El total del movimiento no coincide con el desglose de billetes.');
        }
        const db = executor ?? await getDb();
        await db.runAsync(
            'INSERT INTO cash_movements (type, total_cents, denominations_json, note, created_at) VALUES (?, ?, ?, ?, ?)',
            [type, totalCents, JSON.stringify(denomsDelta), note || null, createdAt.toISOString()]
        );
    },

    async listCashMovements(limit: number = 50): Promise<CashMovement[]> {
        const db = await getDb();
        return await db.getAllAsync<CashMovement>(
            'SELECT * FROM cash_movements ORDER BY created_at DESC LIMIT ?',
            [limit]
        );
    },

    async getCashMovement(id: number, executor?: CashDb): Promise<CashMovement | null> {
        const db = executor ?? await getDb();
        const result = await db.getAllAsync<CashMovement>('SELECT * FROM cash_movements WHERE id = ?', [id]);
        return result.length > 0 ? result[0] : null;
    },

    // Draft persistence
    async getCashCounterDraft(): Promise<Record<string, string>> {
        const db = await getDb();
        const result = await db.getAllAsync<{ value: string }>(
            'SELECT value FROM app_settings WHERE key = ?',
            ['cash_counter_draft']
        );
        if (result.length > 0) {
            try {
                const draft = JSON.parse(result[0].value);
                if (!draft || typeof draft !== 'object' || Array.isArray(draft)
                    || Object.values(draft).some(value => typeof value !== 'string')) return {};
                return draft;
            } catch (e) {
                return {};
            }
        }
        return {};
    },

    async setCashCounterDraft(draft: Record<string, string>): Promise<void> {
        const db = await getDb();
        await db.runAsync(
            'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
            ['cash_counter_draft', JSON.stringify(draft)]
        );
    },

    // Transactional Add/Subtract
    async applyMovement(type: 'IN' | 'OUT', denomsToApply: Record<string, number>, note?: string): Promise<void> {
        validateMovementType(type);
        const totalCents = validateCashDenominations(denomsToApply);
        if (totalCents === 0) throw new Error('El conteo actual está vacío');
        const db = await getDb();

        await db.withExclusiveTransactionAsync(async txn => {
            // One timestamp for the entire operation, even if SQL spans midnight.
            const now = new Date();
            await resetCashDay(txn, now);
            const currentState = await this.getCashState(txn);
            const newDenoms = { ...currentState.denoms };

            for (const [denom, qty] of Object.entries(denomsToApply)) {
                if (qty === 0) continue;

                const currentCount = newDenoms[denom] || 0;

                if (type === 'IN') {
                    newDenoms[denom] = currentCount + qty;
                } else {
                    if (currentCount < qty) {
                        throw new Error(`No hay suficientes billetes/monedas de $${denom}`);
                    }
                    newDenoms[denom] = currentCount - qty;
                }
            }

            await this.setCashState(newDenoms, txn);
            await this.addCashMovement(type, totalCents, denomsToApply, note, txn, now);
        });
    },

    async deleteCashMovement(id: number): Promise<void> {
        const db = await getDb();

        await db.withExclusiveTransactionAsync(async txn => {
            // 1. Get the movement
            const mov = await this.getCashMovement(id, txn);
            if (!mov) throw new Error('Movimiento no encontrado');
            validateMovementType(mov.type);

            // 2. Reverse the effect on cash state
            // If it was IN, we SUBTRACT. If it was OUT, we ADD.
            const currentState = await this.getCashState(txn);
            const newDenoms = { ...currentState.denoms };
            const movDenoms = JSON.parse(mov.denominations_json) as Record<string, number>;
            if (validateCashDenominations(movDenoms) !== mov.total_cents || mov.total_cents <= 0) {
                throw new Error('El total del movimiento no coincide con el desglose de billetes.');
            }

            for (const [denomStr, qty] of Object.entries(movDenoms)) {
                const currentCount = newDenoms[denomStr] || 0;

                if (mov.type === 'IN') {
                    // Was added, so now remove
                    if (currentCount < qty) {
                        throw new Error(`No se puede eliminar: el saldo actual de $${denomStr} es menor al que se ingresó originalmente.`);
                    }
                    newDenoms[denomStr] = currentCount - qty;
                } else {
                    // Was removed, so now add back
                    newDenoms[denomStr] = currentCount + qty;
                }
            }

            // 3. Update state and delete movement
            await this.setCashState(newDenoms, txn);
            await txn.runAsync('DELETE FROM cash_movements WHERE id = ?', [id]);
        });
    },

    // Daily reset logic
    async getCashStateLastResetDay(executor?: CashDb): Promise<string | null> {
        const db = executor ?? await getDb();
        const result = await db.getAllAsync<{ value: string }>(
            'SELECT value FROM app_settings WHERE key = ?',
            ['cash_state_last_reset_day']
        );
        if (result.length > 0) {
            return result[0].value;
        }
        return null;
    },

    async setCashStateLastResetDay(day: string, executor?: CashDb): Promise<void> {
        const db = executor ?? await getDb();
        await db.runAsync(
            'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
            ['cash_state_last_reset_day', day]
        );
    },

    async resetCashStateIfNewDay(): Promise<boolean> {
        const db = await getDb();
        let reset = false;
        await db.withExclusiveTransactionAsync(async txn => {
            reset = await resetCashDay(txn);
        });
        return reset;
    }
};
