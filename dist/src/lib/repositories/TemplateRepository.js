"use strict";
/**
 * TemplateRepository - PostgreSQL Implementation
 * Handles all database operations for message templates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateRepository = void 0;
const db_1 = require("../db");
class TemplateRepository {
    async findAll() {
        const result = await db_1.pool.query('SELECT * FROM templates ORDER BY id ASC');
        return result.rows;
    }
    async findById(id) {
        const result = await db_1.pool.query('SELECT * FROM templates WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    async create(template) {
        const result = await db_1.pool.query(`
            INSERT INTO templates (name, message, type)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [template.name, template.message, template.type]);
        return result.rows[0];
    }
    async update(id, data) {
        const fields = [];
        const params = [];
        let paramIndex = 1;
        if (data.name !== undefined) {
            fields.push(`name = $${paramIndex++}`);
            params.push(data.name);
        }
        if (data.message !== undefined) {
            fields.push(`message = $${paramIndex++}`);
            params.push(data.message);
        }
        if (data.type !== undefined) {
            fields.push(`type = $${paramIndex++}`);
            params.push(data.type);
        }
        if (fields.length === 0) {
            return;
        }
        params.push(id);
        const query = `UPDATE templates SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
        await db_1.pool.query(query, params);
    }
    async delete(id) {
        await db_1.pool.query('DELETE FROM templates WHERE id = $1', [id]);
    }
}
exports.TemplateRepository = TemplateRepository;
