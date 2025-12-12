"use strict";
/**
 * ActivityRepository - PostgreSQL Implementation
 * Handles all database operations for activity timeline
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityRepository = void 0;
const db_1 = require("../db");
const DEFAULT_LIMIT = 50;
class ActivityRepository {
    /**
     * Find activities by contact CPF, ordered by most recent first
     */
    async findByContact(cpf, limit = DEFAULT_LIMIT) {
        const result = await db_1.pool.query(`
            SELECT * FROM activities 
            WHERE contact_cpf = $1 
            ORDER BY created_at DESC 
            LIMIT $2
        `, [cpf, limit]);
        return result.rows;
    }
    /**
     * Create a new activity
     */
    async create(data) {
        const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;
        const result = await db_1.pool.query(`
            INSERT INTO activities (contact_cpf, type, subtype, title, description, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
        `, [
            data.contact_cpf,
            data.type,
            data.subtype || null,
            data.title,
            data.description || null,
            metadataJson
        ]);
        return result.rows[0];
    }
    /**
     * Find recent activities with optional filters
     */
    async findRecent(filters) {
        let query = 'SELECT * FROM activities WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        if (filters === null || filters === void 0 ? void 0 : filters.cpf) {
            query += ` AND contact_cpf = $${paramIndex++}`;
            params.push(filters.cpf);
        }
        if (filters === null || filters === void 0 ? void 0 : filters.type) {
            query += ` AND type = $${paramIndex++}`;
            params.push(filters.type);
        }
        query += ' ORDER BY created_at DESC';
        const limit = (filters === null || filters === void 0 ? void 0 : filters.limit) || DEFAULT_LIMIT;
        query += ` LIMIT $${paramIndex++}`;
        params.push(limit);
        if (filters === null || filters === void 0 ? void 0 : filters.offset) {
            query += ` OFFSET $${paramIndex++}`;
            params.push(filters.offset);
        }
        const result = await db_1.pool.query(query, params);
        return result.rows;
    }
    /**
     * Count activities by contact CPF
     */
    async countByContact(cpf) {
        const result = await db_1.pool.query('SELECT COUNT(*) as count FROM activities WHERE contact_cpf = $1', [cpf]);
        return parseInt(result.rows[0].count);
    }
}
exports.ActivityRepository = ActivityRepository;
