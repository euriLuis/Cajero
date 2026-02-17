import { getDb } from './sqlite';

export const runMigrations = async (): Promise<void> => {
    const db = await getDb();

    // 1. Ensure schema_version table exists
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER NOT NULL
        );
    `);

    // 2. Check current version
    const result = await db.getAllAsync<{ version: number }>('SELECT version FROM schema_version');
    let currentVersion = 0;

    if (result.length === 0) {
        await db.runAsync('INSERT INTO schema_version (version) VALUES (0)');
    } else {
        currentVersion = result[0].version;
    }

    // 3. Run migrations
    if (currentVersion < 1) {
        // Migration v1
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price_cents INTEGER NOT NULL,
                active INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at INTEGER NOT NULL,
                total_cents INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                product_name_snapshot TEXT NOT NULL,
                unit_price_snapshot_cents INTEGER NOT NULL,
                qty INTEGER NOT NULL,
                line_total_cents INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS withdrawals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at INTEGER NOT NULL,
                amount_cents INTEGER NOT NULL,
                reason TEXT
            );
        `);

        await db.runAsync('UPDATE schema_version SET version = 1');
    }

    if (currentVersion < 2) {
        // Migration v2: Add app_settings table for cash counter and other app settings
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        `);

        await db.runAsync('UPDATE schema_version SET version = 2');
    }

    if (currentVersion < 3) {
        // Migration v3: Add cash management tables
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS cash_state (
                id INTEGER PRIMARY KEY CHECK(id=1),
                denominations_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cash_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                total_cents INTEGER NOT NULL,
                denominations_json TEXT NOT NULL,
                note TEXT,
                created_at TEXT NOT NULL
            );
        `);

        // Initial insert for cash_state if it doesn't exist
        const stateExists = await db.getAllAsync('SELECT id FROM cash_state WHERE id = 1');
        if (stateExists.length === 0) {
            await db.runAsync(
                'INSERT INTO cash_state (id, denominations_json, updated_at) VALUES (1, ?, ?)',
                [JSON.stringify({}), new Date().toISOString()]
            );
        }

        await db.runAsync('UPDATE schema_version SET version = 3');
    }
};
