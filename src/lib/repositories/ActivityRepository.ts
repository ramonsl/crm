/**
 * ActivityRepository - PostgreSQL Implementation
 * Handles all database operations for activity timeline
 */

import { pool } from '../db';
import type { ActivityRow } from '../types';
import type {
    CreateActivityDto,
    ActivityFilters,
} from './dtos';
import type { IActivityRepository } from './interfaces';

const DEFAULT_LIMIT = 50;

export class ActivityRepository implements IActivityRepository {

    /**
     * Find activities by contact CPF, ordered by most recent first
     */
    async findByContact(cpf: string, limit: number = DEFAULT_LIMIT): Promise<ActivityRow[]> {
        const result = await pool.query(`
            SELECT * FROM activities 
            WHERE contact_cpf = $1 
            ORDER BY created_at DESC 
            LIMIT $2
        `, [cpf, limit]);
        return result.rows as ActivityRow[];
    }

    /**
     * Create a new activity
     */
    async create(data: CreateActivityDto): Promise<ActivityRow> {
        const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

        const result = await pool.query(`
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

        return result.rows[0] as ActivityRow;
    }

    /**
     * Find recent activities with optional filters
     */
    async findRecent(filters?: ActivityFilters): Promise<ActivityRow[]> {
        let query = 'SELECT * FROM activities WHERE 1=1';
        const params: (string | number)[] = [];
        let paramIndex = 1;

        if (filters?.cpf) {
            query += ` AND contact_cpf = $${paramIndex++}`;
            params.push(filters.cpf);
        }

        if (filters?.type) {
            query += ` AND type = $${paramIndex++}`;
            params.push(filters.type);
        }

        query += ' ORDER BY created_at DESC';

        const limit = filters?.limit || DEFAULT_LIMIT;
        query += ` LIMIT $${paramIndex++}`;
        params.push(limit);

        if (filters?.offset) {
            query += ` OFFSET $${paramIndex++}`;
            params.push(filters.offset);
        }

        const result = await pool.query(query, params);
        return result.rows as ActivityRow[];
    }

    /**
     * Count activities by contact CPF
     */
    async countByContact(cpf: string): Promise<number> {
        const result = await pool.query(
            'SELECT COUNT(*) as count FROM activities WHERE contact_cpf = $1',
            [cpf]
        );
        return parseInt(result.rows[0].count);
    }
}
