/**
 * SettingRepository - Implementation
 * Handles all database operations for system settings
 */

import type { DatabaseInstance, SettingRow } from '../types';
import type { ISettingRepository } from './interfaces';

export class SettingRepository implements ISettingRepository {
    constructor(private db: DatabaseInstance) { }

    async get(key: string): Promise<string | null> {
        const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
        const result = stmt.get(key) as SettingRow | undefined;
        return result?.value || null;
    }

    async set(key: string, value: string): Promise<void> {
        const stmt = this.db.prepare(`
            INSERT INTO settings (key, value) 
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        stmt.run(key, value);
    }

    async getMultiple(keys: string[]): Promise<SettingRow[]> {
        if (keys.length === 0) {
            return [];
        }

        const placeholders = keys.map(() => '?').join(',');
        const query = `SELECT key, value FROM settings WHERE key IN (${placeholders})`;
        const stmt = this.db.prepare(query);
        return stmt.all(...keys) as SettingRow[];
    }

    async getAll(): Promise<SettingRow[]> {
        const stmt = this.db.prepare('SELECT key, value FROM settings');
        return stmt.all() as SettingRow[];
    }
}
