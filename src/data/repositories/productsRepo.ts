import { getDb } from '../db';
import { Product } from '../../domain/models/Product';

export const productsRepo = {
    async listActiveProducts(search?: string): Promise<Product[]> {
        const db = await getDb();
        let query = 'SELECT * FROM products WHERE active = 1';
        let params: any[] = [];

        if (search) {
            query += ' AND name LIKE ?';
            params.push(`%${search}%`);
        }

        query += ' ORDER BY name ASC';

        const result = await db.getAllAsync<any>(query, params);

        return result.map(row => ({
            id: row.id,
            name: row.name,
            priceCents: row.price_cents,
            active: row.active,
            updatedAt: row.updated_at
        }));
    },

    async createProduct(name: string, priceCents: number): Promise<void> {
        const db = await getDb();
        const now = Date.now();
        await db.runAsync(
            'INSERT INTO products (name, price_cents, active, updated_at) VALUES (?, ?, 1, ?)',
            [name, priceCents, now]
        );
    },

    async updateProduct(id: number, updates: { name: string; priceCents: number }): Promise<void> {
        const db = await getDb();
        const now = Date.now();
        await db.runAsync(
            'UPDATE products SET name = ?, price_cents = ?, updated_at = ? WHERE id = ?',
            [updates.name, updates.priceCents, now, id]
        );
    },

    async deactivateProduct(id: number): Promise<void> {
        const db = await getDb();
        const now = Date.now();
        await db.runAsync(
            'UPDATE products SET active = 0, updated_at = ? WHERE id = ?',
            [now, id]
        );
    },
};
