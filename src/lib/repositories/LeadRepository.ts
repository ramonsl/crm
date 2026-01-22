/**
 * LeadRepository - PostgreSQL Implementation
 * Handles all database operations for leads/contacts
 */

import { pool } from '../db';
import { dbLogger } from '@/lib/logger';
import type { LeadRow } from '../types';
import type { QueryParams } from '@/types/database';
import type {
    CreateLeadDto,
    UpdateLeadDto,
    LeadFilters,
} from './dtos';
import type { ILeadRepository } from './interfaces';
import { AppError } from '@/lib/errors/AppError';

export class LeadRepository implements ILeadRepository {
    // Pool is imported directly, no need for constructor injection

    async findAll(filters?: LeadFilters & Record<string, any>): Promise<{ data: LeadRow[], total: number }> {
        let query = 'SELECT * FROM leads WHERE 1=1';
        const params: QueryParams = [];
        let paramIndex = 1;

        // Apply filters
        if (filters?.search) {
            query += ` AND (nome ILIKE $${paramIndex} OR cpf ILIKE $${paramIndex} OR telefone ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            params.push(`%${filters.search}%`);
            paramIndex++;
        }

        if (filters?.status && filters.status !== 'all') {
            const statuses = filters.status.split(',').map((s: string) => s.trim());
            if (statuses.length > 0) {
                const conditions = statuses.map(() => `status = $${paramIndex++}`).join(' OR ');
                query += ` AND (${conditions})`;
                statuses.forEach((s: string) => params.push(s));
            }
        }

        if (filters?.exclude_status) {
            const excluded = filters.exclude_status.split(',').map((s: string) => s.trim());
            if (excluded.length > 0) {
                const conditions = excluded.map(() => `status != $${paramIndex++}`).join(' AND ');
                query += ` AND (${conditions})`;
                excluded.forEach((s: string) => params.push(s));
            }
        }

        if (filters?.semester) {
            const semesters = filters.semester.split(',');
            if (semesters.length > 0) {
                const conditions = semesters.map(() => `tipo_ingresso ILIKE $${paramIndex++}`).join(' OR ');
                query += ` AND (${conditions})`;
                semesters.forEach((s: string) => params.push(`%${s.trim()}%`));
            }
        }

        if (filters?.course) {
            const courses = filters.course.split(',');
            if (courses.length > 0) {
                const conditions = courses.map(() => `curso_interesse ILIKE $${paramIndex++}`).join(' OR ');
                query += ` AND (${conditions})`;
                courses.forEach((s: string) => params.push(`%${s.trim()}%`));
            }
        }

        if (filters?.last_message_period) {
            if (filters.last_message_period === '1h') {
                query += " AND last_message_time >= NOW() - INTERVAL '1 hour'";
            } else if (filters.last_message_period === 'today') {
                query += " AND last_message_time >= NOW() - INTERVAL '24 hours'";
            } else if (filters.last_message_period === '1-3d') {
                query += " AND last_message_time >= NOW() - INTERVAL '3 days' AND last_message_time < NOW() - INTERVAL '1 day'";
            } else if (filters.last_message_period === '3-7d') {
                query += " AND last_message_time >= NOW() - INTERVAL '7 days' AND last_message_time < NOW() - INTERVAL '3 days'";
            } else if (filters.last_message_period === '7-15d') {
                query += " AND last_message_time >= NOW() - INTERVAL '15 days' AND last_message_time < NOW() - INTERVAL '7 days'";
            } else if (filters.last_message_period === '15d+') {
                query += " AND last_message_time < NOW() - INTERVAL '15 days' AND last_message_time IS NOT NULL";
            } else if (filters.last_message_period === 'never') {
                query += " AND last_message_time IS NULL";
            }
        }

        if (filters?.is_new === '1') {
            query += ' AND is_new = 1';
        }

        if (filters?.status_changed === '1') {
            query += ' AND status_changed = 1';
        }

        if (filters?.hasUnread) {
            query += ' AND unread_count > 0';
        }

        // Count total before pagination
        const countQueryRoot = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        // Note: count query needs same params
        const countResult = await pool.query(countQueryRoot, params);
        const total = parseInt(countResult.rows[0].total);

        // Sorting
        const sortBy = filters?.sort_by || 'updated_at';
        const sortOrder = (filters?.sort_order || 'desc').toUpperCase();

        const allowedColumns = ['nome', 'email', 'telefone', 'cpf', 'status', 'tipo_ingresso', 'curso_interesse', 'escola', 'created_at', 'updated_at', 'last_message_time'];
        const validSortBy = allowedColumns.includes(sortBy) ? sortBy : 'updated_at';
        const validSortOrder = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';

        query += ` ORDER BY ${validSortBy} ${validSortOrder}`;

        // Pagination
        if (filters?.pageSize) {
            query += ` LIMIT $${paramIndex++}`;
            params.push(filters.pageSize);

            if (filters?.page && filters.page > 1) {
                query += ` OFFSET $${paramIndex++}`;
                params.push((filters.page - 1) * filters.pageSize);
            }
        }

        const result = await pool.query(query, params);
        return { data: result.rows as LeadRow[], total };
    }

    async findById(id: number): Promise<LeadRow | null> {
        const result = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    async findByCpf(cpf: string): Promise<LeadRow | null> {
        const result = await pool.query('SELECT * FROM leads WHERE cpf = $1', [cpf]);
        return result.rows[0] || null;
    }

    async findByPhone(phone: string): Promise<LeadRow | null> {
        // Try exact match first
        let result = await pool.query('SELECT * FROM leads WHERE telefone = $1', [phone]);
        if (result.rows[0]) return result.rows[0];

        // Try with variations (remove country code)
        const phoneWithoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;
        result = await pool.query('SELECT * FROM leads WHERE telefone = $1', [phoneWithoutCountry]);
        if (result.rows[0]) return result.rows[0];

        // Try last 8 digits match (fallback)
        if (phone.length >= 8) {
            const last8 = phone.slice(-8);
            result = await pool.query('SELECT * FROM leads WHERE telefone LIKE $1', [`%${last8}`]);
            if (result.rows[0]) return result.rows[0];
        }

        return null;
    }

    async create(data: CreateLeadDto): Promise<LeadRow> {
        try {
            const result = await pool.query(`
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

            return result.rows[0] as LeadRow;
        } catch (error: any) {
            if (error.code === '23505') { // Unique constraint violation
                throw new AppError('CPF já cadastrado', 409);
            }
            throw error;
        }
    }

    async update(cpf: string, data: UpdateLeadDto): Promise<void> {
        const fields: string[] = [];
        const params: QueryParams = [];
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
        if (data.is_new !== undefined) {
            fields.push(`is_new = $${paramIndex++}`);
            params.push(data.is_new);
        }
        if (data.status_changed !== undefined) {
            fields.push(`status_changed = $${paramIndex++}`);
            params.push(data.status_changed);
        }
        if (data.status_changed_at !== undefined) {
            // If explicit string provided or special case
            if (data.status_changed_at === 'NOW()') { // Check if we want to support raw SQL keywords or just pass values
                // For safety with prepared statements, we usually pass values. 
                // But route logic was: CASE WHEN $5 = 1 THEN NOW() ELSE status_changed_at END
                // Simpler approach: Route calculates date or passes specific simplified logic.
                // Let's assume route passes actual date string or null.
                // If route needs conditional update, repository might need to be smarter or route does logic.
                // The route had: status_changed_at = CASE WHEN $5 = 1 THEN NOW() ELSE status_changed_at END
                // This implies conditional update based on input.
                // Repository `update` is usually simple SET key=val.
                // I will handle simple set here. Logic should move to service or caller.
                // BUT, for status_changed logic, caller can pass new Date().toISOString().
            }
            fields.push(`status_changed_at = $${paramIndex++}`);
            params.push(data.status_changed_at);
        }
        if (data.data_inscricao !== undefined) {
            fields.push(`data_inscricao = $${paramIndex++}`);
            params.push(data.data_inscricao);
        }
        if (data.last_import_date) {
            fields.push('last_import_date = NOW()');
        }

        if (fields.length === 0) {
            return; // Nothing to update
        }

        fields.push('updated_at = NOW()');
        params.push(cpf); // Add CPF for WHERE clause

        const query = `UPDATE leads SET ${fields.join(', ')} WHERE cpf = $${paramIndex}`;
        await pool.query(query, params);
    }

    async delete(cpf: string): Promise<void> {
        await pool.query('DELETE FROM leads WHERE cpf = $1', [cpf]);
    }

    async deleteAll(): Promise<void> {
        await pool.query('DELETE FROM leads');
    }

    async updateLastMessage(cpf: string, message: string, time: string): Promise<void> {
        await pool.query(`
            UPDATE leads 
            SET last_message = $1, last_message_time = $2 
            WHERE cpf = $3
        `, [message, time, cpf]);
    }

    async incrementUnreadCount(cpf: string): Promise<void> {
        await pool.query(`
            UPDATE leads 
            SET unread_count = COALESCE(unread_count, 0) + 1 
            WHERE cpf = $1
        `, [cpf]);
    }

    async resetUnreadCount(cpf: string): Promise<void> {
        await pool.query(`
            UPDATE leads 
            SET unread_count = 0 
            WHERE cpf = $1
        `, [cpf]);
    }

    async count(filters?: LeadFilters): Promise<number> {
        let query = 'SELECT COUNT(*) as count FROM leads WHERE 1=1';
        const params: QueryParams = [];
        let paramIndex = 1;

        // Apply same filters as findAll
        if (filters?.status && filters.status !== 'all') {
            query += ` AND status = $${paramIndex++}`;
            params.push(filters.status);
        }

        if (filters?.curso && filters.curso !== 'all') {
            query += ` AND curso_interesse = $${paramIndex++}`;
            params.push(filters.curso);
        }

        if (filters?.escola && filters.escola !== 'all') {
            query += ` AND escola = $${paramIndex++}`;
            params.push(filters.escola);
        }

        if (filters?.search) {
            const searchParam = `%${filters.search}%`;
            query += ` AND (nome ILIKE $${paramIndex} OR cpf ILIKE $${paramIndex} OR telefone ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            paramIndex++;
            params.push(searchParam);
        }

        if (filters?.hasUnread) {
            query += ' AND unread_count > 0';
        }

        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count);
    }

    // Synchronous wrappers for backward compatibility (deprecated - use async versions)
    findAllSync(filters?: LeadFilters): LeadRow[] {
        dbLogger.warn('findAllSync is deprecated. Use findAll() instead.');
        // Return empty array - callers need to migrate to async
        return [];
    }

    findByIdSync(id: number): LeadRow | null {
        dbLogger.warn('findByIdSync is deprecated. Use findById() instead.');
        return null;
    }

    async findConflictingPhone(phone: string, excludeCpf: string): Promise<LeadRow | null> {
        const result = await pool.query('SELECT * FROM leads WHERE telefone = $1 AND cpf != $2', [phone, excludeCpf]);
        return result.rows[0] || null;
    }

    async importUpdate(cpf: string, data: UpdateLeadDto): Promise<void> {
        return this.update(cpf, data);
    }

    async importMerge(targetCpf: string, mergedData: UpdateLeadDto): Promise<void> {
        return this.update(targetCpf, mergedData);
    }

    async updateCpf(oldCpf: string, newCpf: string, data: LeadRow): Promise<void> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { cpf, nome, email, telefone, status, tipo_ingresso, curso_interesse, escola, created_at, updated_at, last_message, unread_count, last_message_time, profile_image } = data;

            // Insert new record with new CPF
            await client.query(`
                INSERT INTO leads (cpf, nome, email, telefone, status, tipo_ingresso, curso_interesse, escola, created_at, updated_at, last_message, unread_count, last_message_time, profile_image)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11, $12, $13)
            `, [newCpf, nome, email, telefone, status, tipo_ingresso, curso_interesse, escola, created_at, last_message, unread_count, last_message_time, profile_image]);

            // Update messages reference
            await client.query('UPDATE messages SET contact_phone = $1 WHERE contact_phone = $2', [newCpf, oldCpf]);

            // Delete old record
            await client.query('DELETE FROM leads WHERE cpf = $1', [oldCpf]);

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
}
