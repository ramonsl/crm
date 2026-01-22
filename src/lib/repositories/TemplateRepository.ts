/**
 * TemplateRepository - PostgreSQL Implementation
 * Handles all database operations for message templates
 */

import { pool } from '../db';
import type { QueryParams } from "@/types/database";
import type { TemplateRow } from '../types';
import type { CreateTemplateDto, UpdateTemplateDto } from './dtos';
import type { ITemplateRepository } from './interfaces';

export class TemplateRepository implements ITemplateRepository {

    async findAll(): Promise<TemplateRow[]> {
        const result = await pool.query('SELECT * FROM templates ORDER BY created_at DESC');
        return result.rows as TemplateRow[];
    }

    async findById(id: number): Promise<TemplateRow | null> {
        const result = await pool.query('SELECT * FROM templates WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    async create(template: CreateTemplateDto): Promise<TemplateRow> {
        const result = await pool.query(`
            INSERT INTO templates (name, message, type)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [template.name, template.message, template.type]);

        return result.rows[0] as TemplateRow;
    }

    async update(id: number, data: UpdateTemplateDto): Promise<void> {
        const fields: string[] = [];
        const params: QueryParams = [];
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
        await pool.query(query, params);
    }

    async delete(id: number): Promise<void> {
        await pool.query('DELETE FROM templates WHERE id = $1', [id]);
    }
}
