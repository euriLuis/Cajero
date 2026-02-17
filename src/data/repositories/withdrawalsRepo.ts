import { getDb } from '../db';
import { Withdrawal } from '../../domain/models/Withdrawal';

export const withdrawalsRepo = {
    async createWithdrawal(amountCents: number, reason?: string, createdAtMs?: number): Promise<void> {
        const db = await getDb();
        const createdAt = createdAtMs ?? Date.now();
        await db.runAsync(
            'INSERT INTO withdrawals (amount_cents, reason, created_at) VALUES (?, ?, ?)',
            [amountCents, reason || null, createdAt]
        );
    },

    async listWithdrawalsByRange(startMs: number, endMs: number): Promise<Withdrawal[]> {
        const db = await getDb();
        const result = await db.getAllAsync<any>(
            'SELECT * FROM withdrawals WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC',
            [startMs, endMs]
        );

        return result.map(row => ({
            id: row.id,
            createdAt: row.created_at,
            amountCents: row.amount_cents,
            reason: row.reason
        }));
    },

    async sumWithdrawalsByRange(startMs: number, endMs: number): Promise<number> {
        const db = await getDb();
        const result = await db.getFirstAsync<any>(
            'SELECT SUM(amount_cents) as total FROM withdrawals WHERE created_at >= ? AND created_at <= ?',
            [startMs, endMs]
        );
        return result?.total || 0;
    },

    async deleteWithdrawal(id: number): Promise<void> {
        const db = await getDb();
        await db.runAsync('DELETE FROM withdrawals WHERE id = ?', [id]);
    }
};
