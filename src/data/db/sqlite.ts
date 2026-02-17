import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
    if (!db) {
        db = await SQLite.openDatabaseAsync('tienda_caja.db');
    }
    return db;
};
