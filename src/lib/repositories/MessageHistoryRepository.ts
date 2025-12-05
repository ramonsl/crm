/**
 * MessageHistoryRepository - Implementation
 * Handles all database operations for message history
 */

import type { DatabaseInstance, MessageHistoryRow } from '../types';
import type { CreateMessageHistoryDto, MessageHistoryFilters } from './dtos';
import type { IMessageHistoryRepository } from './interfaces';

export class MessageHistoryRepository implements IMessageHistoryRepository {
    constructor(private db: DatabaseInstance) { }

    async findByCpf(cpf: string): Promise<MessageHistoryRow[]> {
        const stmt = this.db.prepare(`
            SELECT * FROM message_history 
            WHERE contact_cpf = ? 
            ORDER BY sent_at DESC
        `);
        return stmt.all(cpf) as MessageHistoryRow[];
    }

    async create(data: CreateMessageHistoryDto): Promise<void> {
        const stmt = this.db.prepare(`
            INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
            VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(
            data.contact_cpf,
            data.template_id || null,
            data.template_name,
            data.message_content,
            data.status
        );
    }

    async findRecent(filters?: MessageHistoryFilters): Promise<MessageHistoryRow[]> {
        let query = 'SELECT * FROM message_history WHERE 1=1';
        const params: any[] = [];

        if (filters?.cpf) {
            query += ' AND contact_cpf = ?';
            params.push(filters.cpf);
        }

        if (filters?.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }

        query += ' ORDER BY sent_at DESC';

        if (filters?.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);

            if (filters?.offset) {
                query += ' OFFSET ?';
                params.push(filters.offset);
            }
        }

        const stmt = this.db.prepare(query);
        return stmt.all(...params) as MessageHistoryRow[];
    }

    async countByCpf(cpf: string): Promise<number> {
        const stmt = this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM message_history 
            WHERE contact_cpf = ?
        `);
        const result = stmt.get(cpf) as { count: number };
        return result.count;
    }
}
