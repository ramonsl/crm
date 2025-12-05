/**
 * TemplateRepository - Implementation
 * Handles all database operations for message templates
 */

import type { DatabaseInstance, TemplateRow } from '../types';
import type { CreateTemplateDto, UpdateTemplateDto } from './dtos';
import type { ITemplateRepository } from './interfaces';

export class TemplateRepository implements ITemplateRepository {
    constructor(private db: DatabaseInstance) { }

    async findAll(): Promise<TemplateRow[]> {
        const stmt = this.db.prepare('SELECT * FROM templates ORDER BY id ASC');
        return stmt.all() as TemplateRow[];
    }

    async findById(id: number): Promise<TemplateRow | null> {
        const stmt = this.db.prepare('SELECT * FROM templates WHERE id = ?');
        const result = stmt.get(id) as TemplateRow | undefined;
        return result || null;
    }

    async create(template: CreateTemplateDto): Promise<TemplateRow> {
        const stmt = this.db.prepare(`
            INSERT INTO templates (name, message, type)
            VALUES (?, ?, ?)
        `);

        const result = stmt.run(
            template.name,
            template.message,
            template.type
        );

        return this.findById(result.lastInsertRowid as number) as Promise<TemplateRow>;
    }

    async update(id: number, data: UpdateTemplateDto): Promise<void> {
        const fields: string[] = [];
        const params: any[] = [];

        if (data.name !== undefined) {
            fields.push('name = ?');
            params.push(data.name);
        }
        if (data.message !== undefined) {
            fields.push('message = ?');
            params.push(data.message);
        }
        if (data.type !== undefined) {
            fields.push('type = ?');
            params.push(data.type);
        }

        if (fields.length === 0) {
            return;
        }

        params.push(id);

        const query = `UPDATE templates SET ${fields.join(', ')} WHERE id = ?`;
        const stmt = this.db.prepare(query);
        stmt.run(...params);
    }

    async delete(id: number): Promise<void> {
        const stmt = this.db.prepare('DELETE FROM templates WHERE id = ?');
        stmt.run(id);
    }
}
