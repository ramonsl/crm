/**
 * SessionRepository - PostgreSQL Implementation
 * Handles all database operations for session management
 */

import { pool } from '../db';
import type { SessionRow } from '../types';
import type { ISessionRepository } from './interfaces';
import { v4 as uuidv4 } from 'uuid';

export class SessionRepository implements ISessionRepository {

    /**
     * Create new session
     */
    async create(userId: number, expiresAt: string): Promise<SessionRow> {
        const sessionId = uuidv4();

        const result = await pool.query(`
            INSERT INTO sessions (id, user_id, expires_at, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING *
        `, [sessionId, userId, expiresAt]);

        return result.rows[0] as SessionRow;
    }

    /**
     * Find session by ID
     */
    async findById(sessionId: string): Promise<SessionRow | null> {
        const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
        return result.rows[0] || null;
    }

    /**
     * Find sessions by user ID
     */
    async findByUserId(userId: number): Promise<SessionRow[]> {
        const result = await pool.query(
            'SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows as SessionRow[];
    }

    /**
     * Delete session
     */
    async delete(sessionId: string): Promise<void> {
        await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    }

    /**
     * Delete all sessions for a user
     */
    async deleteByUserId(userId: number): Promise<void> {
        await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    }

    /**
     * Delete expired sessions
     */
    async deleteExpired(): Promise<void> {
        await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
    }
}
