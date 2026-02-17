import { getDb } from '../db';
import { Sale } from '../../domain/models/Sale';
import { SaleItem } from '../../domain/models/SaleItem';

export interface CreateSaleParams {
    items: {
        productId: number;
        productNameSnapshot: string;
        unitPriceSnapshotCents: number;
        qty: number;
    }[];
    createdAtMs?: number;
}

export const salesRepo = {
    async createSale(params: CreateSaleParams): Promise<void> {
        const db = await getDb();

        // Calculate total
        const totalCents = params.items.reduce((sum, item) => {
            return sum + (item.unitPriceSnapshotCents * item.qty);
        }, 0);

        // Start transaction
        await db.withTransactionAsync(async () => {
            // Insert sale
            const createdAt = params.createdAtMs ?? Date.now();
            const result = await db.runAsync(
                'INSERT INTO sales (created_at, total_cents) VALUES (?, ?)',
                [createdAt, totalCents]
            );

            const saleId = result.lastInsertRowId;

            // Insert sale items
            for (const item of params.items) {
                const lineTotalCents = item.unitPriceSnapshotCents * item.qty;
                await db.runAsync(
                    `INSERT INTO sale_items 
                    (sale_id, product_id, product_name_snapshot, unit_price_snapshot_cents, qty, line_total_cents) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        saleId,
                        item.productId,
                        item.productNameSnapshot,
                        item.unitPriceSnapshotCents,
                        item.qty,
                        lineTotalCents
                    ]
                );
            }
        });
    },

    async listSalesByRange(startMs: number, endMs: number): Promise<Sale[]> {
        const db = await getDb();
        const result = await db.getAllAsync<any>(
            'SELECT * FROM sales WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC',
            [startMs, endMs]
        );

        return result.map(row => ({
            id: row.id,
            createdAt: row.created_at,
            totalCents: row.total_cents
        }));
    },

    async getSaleItems(saleId: number): Promise<SaleItem[]> {
        const db = await getDb();
        const result = await db.getAllAsync<any>(
            'SELECT * FROM sale_items WHERE sale_id = ?',
            [saleId]
        );

        return result.map(row => ({
            id: row.id,
            saleId: row.sale_id,
            productId: row.product_id,
            productNameSnapshot: row.product_name_snapshot,
            unitPriceSnapshotCents: row.unit_price_snapshot_cents,
            qty: row.qty,
            lineTotalCents: row.line_total_cents
        }));
    },

    async sumSalesByRange(startMs: number, endMs: number): Promise<number> {
        const db = await getDb();
        const result = await db.getFirstAsync<any>(
            'SELECT SUM(total_cents) as total FROM sales WHERE created_at >= ? AND created_at <= ?',
            [startMs, endMs]
        );
        return result?.total || 0;
    },

    async getSaleItemsSummaryMap(saleIds: number[]): Promise<Record<number, string>> {
        if (saleIds.length === 0) return {};

        const db = await getDb();
        const placeholders = saleIds.map(() => '?').join(',');
        const result = await db.getAllAsync<any>(
            `SELECT sale_id, product_name_snapshot, qty FROM sale_items WHERE sale_id IN (${placeholders}) ORDER BY sale_id, id`,
            saleIds
        );

        // Group by sale_id and build summary
        const summaryMap: Record<number, string> = {};
        const itemsByRoute: Record<number, string[]> = {};

        for (const row of result) {
            const saleId = row.sale_id;
            if (!itemsByRoute[saleId]) {
                itemsByRoute[saleId] = [];
            }
            itemsByRoute[saleId].push(`${row.product_name_snapshot} x${row.qty}`);
        }

        // Build the summary string for each sale
        for (const saleId of saleIds) {
            summaryMap[saleId] = itemsByRoute[saleId]?.join(', ') || '';
        }

        return summaryMap;
    },

    async updateSaleItem(saleItemId: number, updates: { qty?: number; unitPriceSnapshotCents?: number }): Promise<void> {
        const db = await getDb();

        // Get current item
        const item = await db.getFirstAsync<any>(
            'SELECT qty, unit_price_snapshot_cents FROM sale_items WHERE id = ?',
            [saleItemId]
        );

        if (!item) {
            throw new Error('Sale item not found');
        }

        // Use new values or keep existing ones
        const newQty = updates.qty !== undefined ? updates.qty : item.qty;
        const newPrice = updates.unitPriceSnapshotCents !== undefined ? updates.unitPriceSnapshotCents : item.unit_price_snapshot_cents;

        // Calculate new line total
        const newLineTotal = newQty * newPrice;

        // Update sale item
        await db.runAsync(
            'UPDATE sale_items SET qty = ?, unit_price_snapshot_cents = ?, line_total_cents = ? WHERE id = ?',
            [newQty, newPrice, newLineTotal, saleItemId]
        );
    },

    async deleteSaleItem(saleItemId: number): Promise<void> {
        const db = await getDb();
        await db.runAsync(
            'DELETE FROM sale_items WHERE id = ?',
            [saleItemId]
        );
    },

    async recalcSaleTotal(saleId: number): Promise<number> {
        const db = await getDb();

        // Sum all line totals for this sale
        const result = await db.getFirstAsync<any>(
            'SELECT SUM(line_total_cents) as total FROM sale_items WHERE sale_id = ?',
            [saleId]
        );

        const newTotal = result?.total || 0;

        // Update sale total
        await db.runAsync(
            'UPDATE sales SET total_cents = ? WHERE id = ?',
            [newTotal, saleId]
        );

        return newTotal;
    },

    async deleteSale(saleId: number): Promise<void> {
        const db = await getDb();

        await db.withTransactionAsync(async () => {
            // Delete all sale items first
            await db.runAsync('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
            // Then delete the sale
            await db.runAsync('DELETE FROM sales WHERE id = ?', [saleId]);
        });
    },

    async applySaleEdits(
        saleId: number,
        edits: Array<{ type: 'update'; itemId: number; qty: number; unitPriceSnapshotCents: number } | { type: 'delete'; itemId: number }>
    ): Promise<void> {
        const db = await getDb();

        await db.withTransactionAsync(async () => {
            // Apply each edit
            for (const edit of edits) {
                if (edit.type === 'update') {
                    await salesRepo.updateSaleItem(edit.itemId, {
                        qty: edit.qty,
                        unitPriceSnapshotCents: edit.unitPriceSnapshotCents
                    });
                } else if (edit.type === 'delete') {
                    await salesRepo.deleteSaleItem(edit.itemId);
                }
            }

            // Recalculate total
            const newTotal = await salesRepo.recalcSaleTotal(saleId);

            // Check if there are any items left
            const itemCount = await db.getFirstAsync<any>(
                'SELECT COUNT(*) as count FROM sale_items WHERE sale_id = ?',
                [saleId]
            );

            // If no items left, delete the entire sale
            if (itemCount?.count === 0) {
                await db.runAsync('DELETE FROM sales WHERE id = ?', [saleId]);
            }
        });
    },



    async getCurrentSaleDraftTotal(): Promise<number> {
        const db = await getDb();
        const result = await db.getFirstAsync<{ value: string }>(
            'SELECT value FROM app_settings WHERE key = ?',
            ['sale_current_total_cents']
        );

        const parsed = Number(result?.value ?? 0);
        return Number.isFinite(parsed) ? parsed : 0;
    },

    async setCurrentSaleDraftTotal(totalCents: number): Promise<void> {
        const db = await getDb();
        await db.runAsync(
            'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
            ['sale_current_total_cents', String(totalCents)]
        );
    },

    async getProductsSoldSummary(startMs: number, endMs: number): Promise<Array<{ productName: string; totalQty: number }>> {
        const db = await getDb();
        const result = await db.getAllAsync<any>(
            `SELECT product_name_snapshot, SUM(qty) as total_qty 
             FROM sale_items 
             WHERE sale_id IN (
                 SELECT id FROM sales WHERE created_at >= ? AND created_at <= ?
             )
             GROUP BY product_name_snapshot
             ORDER BY total_qty DESC`,
            [startMs, endMs]
        );

        return result.map(row => ({
            productName: row.product_name_snapshot,
            totalQty: row.total_qty
        }));
    },
};
