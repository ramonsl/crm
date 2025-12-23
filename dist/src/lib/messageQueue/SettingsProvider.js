"use strict";
/**
 * Settings Provider
 *
 * Implementation of ISettingsProvider using the database pool.
 * Following DIP: Implements the abstraction.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsProvider = void 0;
const db_1 = require("../db");
const logger_1 = require("../../lib/logger");
class SettingsProvider {
    /**
     * Get a single setting value
     */
    async get(key) {
        var _a;
        try {
            const result = await db_1.pool.query('SELECT value FROM settings WHERE key = $1', [key]);
            return ((_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.value) || null;
        }
        catch (error) {
            logger_1.queueLogger.error('Error getting setting:', error);
            return null;
        }
    }
    /**
     * Get multiple settings
     */
    async getMultiple(keys) {
        try {
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
            const result = await db_1.pool.query(`SELECT key, value FROM settings WHERE key IN (${placeholders})`, keys);
            return result.rows;
        }
        catch (error) {
            logger_1.queueLogger.error('Error getting multiple settings:', error);
            return [];
        }
    }
}
exports.SettingsProvider = SettingsProvider;
