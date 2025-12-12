/**
 * MessageHistoryRepository - PostgreSQL Implementation
 * Handles all database operations for message history
 */

import { pool } from '../db';
import type { MessageHistoryRow } from '../types';
import type { CreateMessageHistoryDto, MessageHistoryFilters } from './dtos';
import type { IMessageHistoryRepository } from './interfaces';

export class MessageHistoryRepository implements IMessageHistoryRepository {

    async findByCpf(cpf: string): Promise<MessageHistoryRow[]> {
        const result = await pool.query(`
            SELECT * FROM message_history 
            WHERE contact_cpf = $1 
            ORDER BY sent_at DESC
        `, [cpf]);
        return result.rows as MessageHistoryRow[];
    }

    async create(data: CreateMessageHistoryDto): Promise<void> {
        await pool.query(`
            INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            data.contact_cpf,
            data.template_id || null,
            data.template_name,
            data.message_content,
            data.status
        ]);
    }

    async findRecent(filters?: MessageHistoryFilters): Promise<MessageHistoryRow[]> {
        let query = 'SELECT * FROM message_history WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (filters?.cpf) {
            query += ` AND contact_cpf = $${paramIndex++}`;
            params.push(filters.cpf);
        }

        if (filters?.status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(filters.status);
        }

        query += ' ORDER BY sent_at DESC';

        if (filters?.limit) {
            query += ` LIMIT $${paramIndex++}`;
            params.push(filters.limit);

            if (filters?.offset) {
                query += ` OFFSET $${paramIndex++}`;
                params.push(filters.offset);
            }
        }

        const result = await pool.query(query, params);
        return result.rows as MessageHistoryRow[];
    }

    async countByCpf(cpf: string): Promise<number> {
        const result = await pool.query(`
            SELECT COUNT(*) as count 
            FROM message_history 
            WHERE contact_cpf = $1
        `, [cpf]);
        return parseInt(result.rows[0].count);
    }
}
