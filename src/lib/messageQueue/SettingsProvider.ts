/**
 * Settings Provider
 * 
 * Implementation of ISettingsProvider using the database pool.
 * Following DIP: Implements the abstraction.
 */

import type { ISettingsProvider } from './interfaces';
import { pool } from '../db';
import { queueLogger } from '@/lib/logger';

export class SettingsProvider implements ISettingsProvider {
    /**
     * Get a single setting value
     */
    async get(key: string): Promise<string | null> {
        try {
            const result = await pool.query(
                'SELECT value FROM settings WHERE key = $1',
                [key]
            );
            return result.rows[0]?.value || null;
        } catch (error) {
            queueLogger.error('Error getting setting:', error);
            return null;
        }
    }

    /**
     * Get multiple settings
     */
    async getMultiple(keys: string[]): Promise<{ key: string; value: string }[]> {
        try {
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
            const result = await pool.query(
                `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
                keys
            );
            return result.rows;
        } catch (error) {
            queueLogger.error('Error getting multiple settings:', error);
            return [];
        }
    }
}
