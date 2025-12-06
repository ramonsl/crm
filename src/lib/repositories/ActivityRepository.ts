/**
 * ActivityRepository - Implementation
 * Handles all database operations for activity timeline
 * 
 * Follows existing repository patterns (LeadRepository)
 */

import type { DatabaseInstance, ActivityRow } from '../types';
import type {
    CreateActivityDto,
    ActivityFilters,
} from './dtos';
import type { IActivityRepository } from './interfaces';

// Run migration to ensure table exists
import '../migrations/addActivitiesTable';

const DEFAULT_LIMIT = 50;

export class ActivityRepository implements IActivityRepository {
    constructor(private db: DatabaseInstance) { }

    /**
     * Find activities by contact CPF, ordered by most recent first
     */
    findByContact(cpf: string, limit: number = DEFAULT_LIMIT): ActivityRow[] {
        const stmt = this.db.prepare(`
            SELECT * FROM activities 
            WHERE contact_cpf = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        `);
        return stmt.all(cpf, limit) as ActivityRow[];
    }

    /**
     * Create a new activity
     */
    create(data: CreateActivityDto): ActivityRow {
        const stmt = this.db.prepare(`
            INSERT INTO activities (contact_cpf, type, subtype, title, description, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

        const result = stmt.run(
            data.contact_cpf,
            data.type,
            data.subtype || null,
            data.title,
            data.description || null,
            metadataJson
        );

        // Return the created activity
        const created = this.db.prepare('SELECT * FROM activities WHERE id = ?').get(result.lastInsertRowid) as ActivityRow;
        return created;
    }

    /**
     * Find recent activities with optional filters
     */
    findRecent(filters?: ActivityFilters): ActivityRow[] {
        let query = 'SELECT * FROM activities WHERE 1=1';
        const params: (string | number)[] = [];

        if (filters?.cpf) {
            query += ' AND contact_cpf = ?';
            params.push(filters.cpf);
        }

        if (filters?.type) {
            query += ' AND type = ?';
            params.push(filters.type);
        }

        query += ' ORDER BY created_at DESC';

        const limit = filters?.limit || DEFAULT_LIMIT;
        query += ' LIMIT ?';
        params.push(limit);

        if (filters?.offset) {
            query += ' OFFSET ?';
            params.push(filters.offset);
        }

        const stmt = this.db.prepare(query);
        return stmt.all(...params) as ActivityRow[];
    }

    /**
     * Count activities by contact CPF
     */
    countByContact(cpf: string): number {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM activities WHERE contact_cpf = ?');
        const result = stmt.get(cpf) as { count: number };
        return result.count;
    }
}
