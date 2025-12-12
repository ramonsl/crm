/**
 * SettingRepository - PostgreSQL Implementation
 * Handles all database operations for system settings
 */

import { pool } from '../db';
import type { SettingRow } from '../types';
import type { ISettingRepository } from './interfaces';

export class SettingRepository implements ISettingRepository {

    async get(key: string): Promise<string | null> {
        const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
        return result.rows[0]?.value || null;
    }

    async set(key: string, value: string): Promise<void> {
        await pool.query(`
            INSERT INTO settings (key, value) 
            VALUES ($1, $2)
            ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
        `, [key, value]);
    }

    async getMultiple(keys: string[]): Promise<SettingRow[]> {
        if (keys.length === 0) {
            return [];
        }

        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
        const query = `SELECT key, value FROM settings WHERE key IN (${placeholders})`;
        const result = await pool.query(query, keys);
        return result.rows as SettingRow[];
    }

    async getAll(): Promise<SettingRow[]> {
        const result = await pool.query('SELECT key, value FROM settings');
        return result.rows as SettingRow[];
    }
}
