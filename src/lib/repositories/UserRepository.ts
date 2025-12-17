/**
 * UserRepository - PostgreSQL Implementation
 * Handles all database operations for user management
 */

import { pool } from '../db';
import type { QueryParams } from "@/types/database";
import type { UserRow } from '../types';
import type { CreateUserDto, UpdateUserDto } from './dtos';
import type { IUserRepository } from './interfaces';

export class UserRepository implements IUserRepository {

    /**
     * Find all users
     */
    async findAll(): Promise<UserRow[]> {
        const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
        return result.rows as UserRow[];
    }

    /**
     * Find user by ID
     */
    async findById(id: number): Promise<UserRow | null> {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<UserRow | null> {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
    }

    /**
     * Create new user
     */
    async create(data: CreateUserDto): Promise<UserRow> {
        const result = await pool.query(`
            INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING *
        `, [
            data.email,
            data.password_hash,
            data.name,
            data.role || 'user'
        ]);

        return result.rows[0] as UserRow;
    }

    /**
     * Update user
     */
    async update(id: number, data: UpdateUserDto): Promise<void> {
        const fields: string[] = [];
        const params: QueryParams = [];
        let paramIndex = 1;

        if (data.email !== undefined) {
            fields.push(`email = $${paramIndex++}`);
            params.push(data.email);
        }
        if (data.password_hash !== undefined) {
            fields.push(`password_hash = $${paramIndex++}`);
            params.push(data.password_hash);
        }
        if (data.name !== undefined) {
            fields.push(`name = $${paramIndex++}`);
            params.push(data.name);
        }
        if (data.role !== undefined) {
            fields.push(`role = $${paramIndex++}`);
            params.push(data.role);
        }
        if (data.active !== undefined) {
            fields.push(`active = $${paramIndex++}`);
            params.push(data.active);
        }

        if (fields.length === 0) {
            return;
        }

        fields.push('updated_at = NOW()');
        params.push(id);

        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
        await pool.query(query, params);
    }

    /**
     * Delete user
     */
    async delete(id: number): Promise<void> {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
    }

    /**
     * Count total users
     */
    async count(): Promise<number> {
        const result = await pool.query('SELECT COUNT(*) as count FROM users');
        return parseInt(result.rows[0].count);
    }
}
