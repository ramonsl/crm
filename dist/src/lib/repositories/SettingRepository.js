"use strict";
/**
 * SettingRepository - PostgreSQL Implementation
 * Handles all database operations for system settings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingRepository = void 0;
const db_1 = require("../db");
class SettingRepository {
    async get(key) {
        var _a;
        const result = await db_1.pool.query('SELECT value FROM settings WHERE key = $1', [key]);
        return ((_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.value) || null;
    }
    async set(key, value) {
        await db_1.pool.query(`
            INSERT INTO settings (key, value) 
            VALUES ($1, $2)
            ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
        `, [key, value]);
    }
    async getMultiple(keys) {
        if (keys.length === 0) {
            return [];
        }
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
        const query = `SELECT key, value FROM settings WHERE key IN (${placeholders})`;
        const result = await db_1.pool.query(query, keys);
        return result.rows;
    }
    async getAll() {
        const result = await db_1.pool.query('SELECT key, value FROM settings');
        return result.rows;
    }
}
exports.SettingRepository = SettingRepository;
