/**
 * LinkedInJobRepository - PostgreSQL Implementation
 * Handles all database operations for LinkedIn jobs
 */

import { pool } from '../db';
import type { LinkedInJobRow, LinkedInJobStatus } from '../types';
import type { ILinkedInJobRepository } from './interfaces';

export class LinkedInJobRepository implements ILinkedInJobRepository {

    async exists(postId: string): Promise<boolean> {
        const result = await pool.query(
            'SELECT 1 FROM linkedin_jobs WHERE linkedin_post_id = $1',
            [postId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    async create(data: Omit<LinkedInJobRow, 'id' | 'created_at'>): Promise<LinkedInJobRow> {
        const result = await pool.query(`
            INSERT INTO linkedin_jobs (
                linkedin_post_id, title, company, location, is_remote, 
                raw_content, formatted_message, url, posted_at, status, error_message
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            data.linkedin_post_id,
            data.title,
            data.company,
            data.location,
            data.is_remote,
            data.raw_content,
            data.formatted_message,
            data.url,
            data.posted_at,
            data.status,
            data.error_message
        ]);

        return result.rows[0];
    }

    async updateStatus(id: number, status: LinkedInJobStatus, errorMessage?: string): Promise<void> {
        await pool.query(`
            UPDATE linkedin_jobs 
            SET status = $2, error_message = $3, created_at = NOW()
            WHERE id = $1
        `, [id, status, errorMessage || null]);
    }

    async getLatest(limit: number): Promise<LinkedInJobRow[]> {
        const result = await pool.query(
            'SELECT * FROM linkedin_jobs ORDER BY created_at DESC LIMIT $1',
            [limit]
        );
        return result.rows as LinkedInJobRow[];
    }

    async getByStatus(status: LinkedInJobStatus, limit: number): Promise<LinkedInJobRow[]> {
        const result = await pool.query(
            'SELECT * FROM linkedin_jobs WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
            [status, limit]
        );
        return result.rows as LinkedInJobRow[];
    }

    async getStats(): Promise<{ total: number; posted: number; error: number }> {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'posted') as posted,
                COUNT(*) FILTER (WHERE status = 'error') as error
            FROM linkedin_jobs
        `);

        const row = result.rows[0];
        return {
            total: parseInt(row.total || '0'),
            posted: parseInt(row.posted || '0'),
            error: parseInt(row.error || '0')
        };
    }

    /**
     * Detailed stats for the Jobs Dashboard.
     * Breaks down by source (remotar vs others), time periods, and tags.
     */
    async getDetailedStats(): Promise<{
        total: number;
        posted: number;
        errors: number;
        today: number;
        last7Days: number;
        bySource: { source: string; count: number }[];
        byTag: { tag: string; count: number }[];
    }> {
        // Basic counts + time-based
        const countsResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'posted') as posted,
                COUNT(*) FILTER (WHERE status = 'error') as errors,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as last7days
            FROM linkedin_jobs
        `);
        const counts = countsResult.rows[0];

        // By source (detect from linkedin_post_id prefix)
        const sourceResult = await pool.query(`
            SELECT 
                CASE 
                    WHEN linkedin_post_id LIKE 'remotar-%' THEN 'Remotar'
                    ELSE 'LinkedIn'
                END as source,
                COUNT(*) as count
            FROM linkedin_jobs
            WHERE status = 'posted'
            GROUP BY source
            ORDER BY count DESC
        `);

        // By tag - parse from title keywords and formatted_message
        const tagResult = await pool.query(`
            SELECT tag, COUNT(*) as count FROM (
                SELECT UNNEST(ARRAY[
                    CASE WHEN formatted_message ILIKE '%ESTÁGIO%' THEN 'Estágio' END,
                    CASE WHEN formatted_message ILIKE '%JÚNIOR%' OR formatted_message ILIKE '%JUNIOR%' THEN 'Júnior' END,
                    CASE WHEN formatted_message ILIKE '%PcD%' THEN 'PcD' END,
                    CASE WHEN formatted_message ILIKE '%INTERNACIONAL%' THEN 'Internacional' END,
                    CASE WHEN formatted_message ILIKE '%PARA MULHERES%' THEN 'Para Mulheres' END,
                    CASE WHEN formatted_message ILIKE '%LGBTQIAP%' THEN 'LGBTQIAP+' END,
                    CASE WHEN formatted_message ILIKE '%JOVEM APRENDIZ%' THEN 'Jovem Aprendiz' END,
                    CASE WHEN formatted_message ILIKE '%FREELANCER%' THEN 'Freelancer' END,
                    CASE WHEN formatted_message ILIKE '%BANCO DE TALENTOS%' THEN 'Banco de Talentos' END,
                    CASE WHEN formatted_message ILIKE '%DIVERSIDADE%' THEN 'Diversidade' END
                ]) as tag
                FROM linkedin_jobs
                WHERE status = 'posted'
            ) sub
            WHERE tag IS NOT NULL
            GROUP BY tag
            ORDER BY count DESC
        `);

        return {
            total: parseInt(counts.total || '0'),
            posted: parseInt(counts.posted || '0'),
            errors: parseInt(counts.errors || '0'),
            today: parseInt(counts.today || '0'),
            last7Days: parseInt(counts.last7days || '0'),
            bySource: sourceResult.rows.map(r => ({ source: r.source, count: parseInt(r.count) })),
            byTag: tagResult.rows.map(r => ({ tag: r.tag, count: parseInt(r.count) }))
        };
    }

    /**
     * Get latest jobs with pagination
     */
    async getLatestPaginated(limit: number, offset: number = 0): Promise<{ jobs: LinkedInJobRow[]; total: number }> {
        const [jobsResult, countResult] = await Promise.all([
            pool.query(
                'SELECT * FROM linkedin_jobs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
                [limit, offset]
            ),
            pool.query('SELECT COUNT(*) as total FROM linkedin_jobs')
        ]);

        return {
            jobs: jobsResult.rows as LinkedInJobRow[],
            total: parseInt(countResult.rows[0].total || '0')
        };
    }
}
