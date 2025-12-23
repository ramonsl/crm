"use strict";
/**
 * LeadRepository - PostgreSQL Implementation
 * Handles all database operations for leads/contacts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadRepository = void 0;
const db_1 = require("../db");
const logger_1 = require("../../lib/logger");
class LeadRepository {
    // Pool is imported directly, no need for constructor injection
    async findAll(filters) {
        let query = 'SELECT * FROM leads WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        // Apply filters
        if ((filters === null || filters === void 0 ? void 0 : filters.status) && filters.status !== 'all') {
            query += ` AND status = $${paramIndex++}`;
            params.push(filters.status);
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.curso) && filters.curso !== 'all') {
            query += ` AND curso_interesse = $${paramIndex++}`;
            params.push(filters.curso);
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.escola) && filters.escola !== 'all') {
            query += ` AND escola = $${paramIndex++}`;
            params.push(filters.escola);
        }
        if (filters === null || filters === void 0 ? void 0 : filters.search) {
            const searchParam = `%${filters.search}%`;
            query += ` AND (nome ILIKE $${paramIndex} OR cpf ILIKE $${paramIndex} OR telefone ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            paramIndex++;
            params.push(searchParam);
        }
        if (filters === null || filters === void 0 ? void 0 : filters.hasUnread) {
            query += ' AND unread_count > 0';
        }
        // Order by
        query += ' ORDER BY created_at DESC';
        // Pagination
        if (filters === null || filters === void 0 ? void 0 : filters.pageSize) {
            query += ` LIMIT $${paramIndex++}`;
            params.push(filters.pageSize);
            if ((filters === null || filters === void 0 ? void 0 : filters.page) && filters.page > 1) {
                query += ` OFFSET $${paramIndex++}`;
                params.push((filters.page - 1) * filters.pageSize);
            }
        }
        const result = await db_1.pool.query(query, params);
        return result.rows;
    }
    async findById(id) {
        const result = await db_1.pool.query('SELECT * FROM leads WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    async findByCpf(cpf) {
        const result = await db_1.pool.query('SELECT * FROM leads WHERE cpf = $1', [cpf]);
        return result.rows[0] || null;
    }
    async findByPhone(phone) {
        // Try exact match first
        let result = await db_1.pool.query('SELECT * FROM leads WHERE telefone = $1', [phone]);
        if (result.rows[0])
            return result.rows[0];
        // Try with variations (remove country code)
        const phoneWithoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;
        result = await db_1.pool.query('SELECT * FROM leads WHERE telefone = $1', [phoneWithoutCountry]);
        if (result.rows[0])
            return result.rows[0];
        // Try last 8 digits match (fallback)
        if (phone.length >= 8) {
            const last8 = phone.slice(-8);
            result = await db_1.pool.query('SELECT * FROM leads WHERE telefone LIKE $1', [`%${last8}`]);
            if (result.rows[0])
                return result.rows[0];
        }
        return null;
    }
    async create(data) {
        const result = await db_1.pool.query(`
            INSERT INTO leads (cpf, nome, telefone, email, status, tipo_ingresso, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING *
        `, [
            data.cpf,
            data.nome,
            data.telefone || null,
            data.email || null,
            data.status || 'NOVO',
            data.tipo_ingresso || null
        ]);
        return result.rows[0];
    }
    async update(cpf, data) {
        const fields = [];
        const params = [];
        let paramIndex = 1;
        // Build dynamic UPDATE query
        if (data.nome !== undefined) {
            fields.push(`nome = $${paramIndex++}`);
            params.push(data.nome);
        }
        if (data.telefone !== undefined) {
            fields.push(`telefone = $${paramIndex++}`);
            params.push(data.telefone);
        }
        if (data.email !== undefined) {
            fields.push(`email = $${paramIndex++}`);
            params.push(data.email);
        }
        if (data.status !== undefined) {
            fields.push(`status = $${paramIndex++}`);
            params.push(data.status);
        }
        if (data.notes !== undefined) {
            fields.push(`notes = $${paramIndex++}`);
            params.push(data.notes);
        }
        if (data.curso_interesse !== undefined) {
            fields.push(`curso_interesse = $${paramIndex++}`);
            params.push(data.curso_interesse);
        }
        if (data.escola !== undefined) {
            fields.push(`escola = $${paramIndex++}`);
            params.push(data.escola);
        }
        if (data.tipo_ingresso !== undefined) {
            fields.push(`tipo_ingresso = $${paramIndex++}`);
            params.push(data.tipo_ingresso);
        }
        if (data.last_message !== undefined) {
            fields.push(`last_message = $${paramIndex++}`);
            params.push(data.last_message);
        }
        if (data.last_message_time !== undefined) {
            fields.push(`last_message_time = $${paramIndex++}`);
            params.push(data.last_message_time);
        }
        if (data.unread_count !== undefined) {
            fields.push(`unread_count = $${paramIndex++}`);
            params.push(data.unread_count);
        }
        if (data.profile_image !== undefined) {
            fields.push(`profile_image = $${paramIndex++}`);
            params.push(data.profile_image);
        }
        if (data.last_template_name !== undefined) {
            fields.push(`last_template_name = $${paramIndex++}`);
            params.push(data.last_template_name);
        }
        if (fields.length === 0) {
            return; // Nothing to update
        }
        fields.push('updated_at = NOW()');
        params.push(cpf); // Add CPF for WHERE clause
        const query = `UPDATE leads SET ${fields.join(', ')} WHERE cpf = $${paramIndex}`;
        await db_1.pool.query(query, params);
    }
    async delete(cpf) {
        await db_1.pool.query('DELETE FROM leads WHERE cpf = $1', [cpf]);
    }
    async updateLastMessage(cpf, message, time) {
        await db_1.pool.query(`
            UPDATE leads 
            SET last_message = $1, last_message_time = $2 
            WHERE cpf = $3
        `, [message, time, cpf]);
    }
    async incrementUnreadCount(cpf) {
        await db_1.pool.query(`
            UPDATE leads 
            SET unread_count = COALESCE(unread_count, 0) + 1 
            WHERE cpf = $1
        `, [cpf]);
    }
    async resetUnreadCount(cpf) {
        await db_1.pool.query(`
            UPDATE leads 
            SET unread_count = 0 
            WHERE cpf = $1
        `, [cpf]);
    }
    async count(filters) {
        let query = 'SELECT COUNT(*) as count FROM leads WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        // Apply same filters as findAll
        if ((filters === null || filters === void 0 ? void 0 : filters.status) && filters.status !== 'all') {
            query += ` AND status = $${paramIndex++}`;
            params.push(filters.status);
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.curso) && filters.curso !== 'all') {
            query += ` AND curso_interesse = $${paramIndex++}`;
            params.push(filters.curso);
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.escola) && filters.escola !== 'all') {
            query += ` AND escola = $${paramIndex++}`;
            params.push(filters.escola);
        }
        if (filters === null || filters === void 0 ? void 0 : filters.search) {
            const searchParam = `%${filters.search}%`;
            query += ` AND (nome ILIKE $${paramIndex} OR cpf ILIKE $${paramIndex} OR telefone ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            paramIndex++;
            params.push(searchParam);
        }
        if (filters === null || filters === void 0 ? void 0 : filters.hasUnread) {
            query += ' AND unread_count > 0';
        }
        const result = await db_1.pool.query(query, params);
        return parseInt(result.rows[0].count);
    }
    // Synchronous wrappers for backward compatibility (deprecated - use async versions)
    findAllSync(filters) {
        logger_1.dbLogger.warn('findAllSync is deprecated. Use findAll() instead.');
        // Return empty array - callers need to migrate to async
        return [];
    }
    findByIdSync(id) {
        logger_1.dbLogger.warn('findByIdSync is deprecated. Use findById() instead.');
        return null;
    }
    findByCpfSync(cpf) {
        logger_1.dbLogger.warn('findByCpfSync is deprecated. Use findByCpf() instead.');
        return null;
    }
}
exports.LeadRepository = LeadRepository;
