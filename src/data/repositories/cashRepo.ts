import { getDb } from '../db/sqlite';

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
    async getCashState(): Promise<CashState> {
        const db = await getDb();
        const result = await db.getAllAsync<{ denominations_json: string; updated_at: string }>(
            'SELECT denominations_json, updated_at FROM cash_state WHERE id = 1'
        );
        if (result.length === 0) {
            return { denoms: {}, updatedAt: new Date().toISOString() };
        }
        try {
            return {
                denoms: JSON.parse(result[0].denominations_json),
                updatedAt: result[0].updated_at
            };
        } catch (e) {
            return { denoms: {}, updatedAt: result[0].updated_at };
        }
    },

    async setCashState(denoms: Record<string, number>): Promise<void> {
        const db = await getDb();
        await db.runAsync(
            'UPDATE cash_state SET denominations_json = ?, updated_at = ? WHERE id = 1',
            [JSON.stringify(denoms), new Date().toISOString()]
        );
    },

    async addCashMovement(type: 'IN' | 'OUT', totalCents: number, denomsDelta: Record<string, number>, note?: string): Promise<void> {
        const db = await getDb();
        await db.runAsync(
            'INSERT INTO cash_movements (type, total_cents, denominations_json, note, created_at) VALUES (?, ?, ?, ?, ?)',
            [type, totalCents, JSON.stringify(denomsDelta), note || null, new Date().toISOString()]
        );
    },

    async listCashMovements(limit: number = 50): Promise<CashMovement[]> {
        const db = await getDb();
        return await db.getAllAsync<CashMovement>(
            'SELECT * FROM cash_movements ORDER BY created_at DESC LIMIT ?',
            [limit]
        );
    },

    async getCashMovement(id: number): Promise<CashMovement | null> {
        const db = await getDb();
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
                return JSON.parse(result[0].value);
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
        const db = await getDb();

        await db.withTransactionAsync(async () => {
            const currentState = await this.getCashState();
            const newDenoms = { ...currentState.denoms };
            let totalCents = 0;

            for (const [denom, qty] of Object.entries(denomsToApply)) {
                if (qty === 0) continue;

                const denomVal = parseInt(denom, 10);
                const currentCount = newDenoms[denom] || 0;

                if (type === 'IN') {
                    newDenoms[denom] = currentCount + qty;
                    totalCents += denomVal * 100 * qty;
                } else {
                    if (currentCount < qty) {
                        throw new Error(`No hay suficientes billetes/monedas de $${denom}`);
                    }
                    newDenoms[denom] = currentCount - qty;
                    totalCents += denomVal * 100 * qty;
                }
            }

            if (totalCents === 0) {
                throw new Error('El conteo actual está vacío');
            }

            await this.setCashState(newDenoms);
            await this.addCashMovement(type, totalCents, denomsToApply, note);
        });
    },

    async deleteCashMovement(id: number): Promise<void> {
        const db = await getDb();

        await db.withTransactionAsync(async () => {
            // 1. Get the movement
            const mov = await this.getCashMovement(id);
            if (!mov) throw new Error('Movimiento no encontrado');

            // 2. Reverse the effect on cash state
            // If it was IN, we SUBTRACT. If it was OUT, we ADD.
            const currentState = await this.getCashState();
            const newDenoms = { ...currentState.denoms };
            const movDenoms = JSON.parse(mov.denominations_json) as Record<string, number>;

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
            await this.setCashState(newDenoms);
            await db.runAsync('DELETE FROM cash_movements WHERE id = ?', [id]);
        });
    }
};
