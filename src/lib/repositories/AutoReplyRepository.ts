/**
 * Auto-Reply Repository
 * Data access layer for auto-reply system
 */

import { pool } from '../neonDb';
import type {
    AutoReply,
    CreateAutoReplyInput,
    UpdateAutoReplyInput,
    AutoReplyLog,
    CreateAutoReplyLogInput,
    AutoReplyStats
} from '@/types/autoReply';

export class AutoReplyRepository {
    /**
     * Find all auto-replies
     */
    async findAll(): Promise<AutoReply[]> {
        const result = await pool.query(
            'SELECT * FROM auto_replies ORDER BY priority DESC, name ASC'
        );
        return result.rows;
    }

    /**
     * Find only active auto-replies
     */
    async findActive(): Promise<AutoReply[]> {
        const result = await pool.query(
            'SELECT * FROM auto_replies WHERE is_active = true ORDER BY priority DESC, name ASC'
        );
        return result.rows;
    }

    /**
     * Find auto-reply by ID
     */
    async findById(id: number): Promise<AutoReply | null> {
        const result = await pool.query(
            'SELECT * FROM auto_replies WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Create new auto-reply
     */
    async create(data: CreateAutoReplyInput): Promise<AutoReply> {
        const result = await pool.query(
            `INSERT INTO auto_replies (
        name, 
        intent_description, 
        example_messages, 
        response_template, 
        is_active, 
        priority, 
        confidence_threshold
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *`,
            [
                data.name,
                data.intent_description,
                data.example_messages || [],
                data.response_template,
                data.is_active ?? true,
                data.priority ?? 0,
                data.confidence_threshold ?? 0.70
            ]
        );
        return result.rows[0];
    }

    /**
     * Update auto-reply
     */
    async update(id: number, data: UpdateAutoReplyInput): Promise<AutoReply | null> {
        const fields: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (data.name !== undefined) {
            fields.push(`name = $${paramCount++}`);
            values.push(data.name);
        }
        if (data.intent_description !== undefined) {
            fields.push(`intent_description = $${paramCount++}`);
            values.push(data.intent_description);
        }
        if (data.example_messages !== undefined) {
            fields.push(`example_messages = $${paramCount++}`);
            values.push(data.example_messages);
        }
        if (data.response_template !== undefined) {
            fields.push(`response_template = $${paramCount++}`);
            values.push(data.response_template);
        }
        if (data.is_active !== undefined) {
            fields.push(`is_active = $${paramCount++}`);
            values.push(data.is_active);
        }
        if (data.priority !== undefined) {
            fields.push(`priority = $${paramCount++}`);
            values.push(data.priority);
        }
        if (data.confidence_threshold !== undefined) {
            fields.push(`confidence_threshold = $${paramCount++}`);
            values.push(data.confidence_threshold);
        }

        if (fields.length === 0) {
            return this.findById(id);
        }

        values.push(id);
        const result = await pool.query(
            `UPDATE auto_replies SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );
        return result.rows[0] || null;
    }

    /**
     * Delete auto-reply
     */
    async delete(id: number): Promise<boolean> {
        const result = await pool.query(
            'DELETE FROM auto_replies WHERE id = $1',
            [id]
        );
        return (result.rowCount || 0) > 0;
    }

    /**
     * Toggle active status
     */
    async toggleActive(id: number): Promise<AutoReply | null> {
        const result = await pool.query(
            'UPDATE auto_replies SET is_active = NOT is_active WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Create auto-reply log entry
     */
    async createLog(data: CreateAutoReplyLogInput): Promise<AutoReplyLog> {
        const result = await pool.query(
            `INSERT INTO auto_reply_logs (
        auto_reply_id,
        phone,
        message,
        detected_intent,
        confidence,
        response_sent
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
            [
                data.auto_reply_id,
                data.phone,
                data.message,
                data.detected_intent,
                data.confidence,
                data.response_sent
            ]
        );
        return result.rows[0];
    }

    /**
     * Get logs for a specific phone number
     */
    async getLogsByPhone(phone: string, limit: number = 50): Promise<AutoReplyLog[]> {
        const result = await pool.query(
            'SELECT * FROM auto_reply_logs WHERE phone = $1 ORDER BY created_at DESC LIMIT $2',
            [phone, limit]
        );
        return result.rows;
    }

    /**
     * Get recent logs
     */
    async getRecentLogs(limit: number = 100): Promise<AutoReplyLog[]> {
        const result = await pool.query(
            'SELECT * FROM auto_reply_logs ORDER BY created_at DESC LIMIT $1',
            [limit]
        );
        return result.rows;
    }

    /**
     * Get statistics
     */
    async getStats(): Promise<AutoReplyStats> {
        // Total sent today
        const todayResult = await pool.query(
            `SELECT COUNT(*) as count 
       FROM auto_reply_logs 
       WHERE created_at >= CURRENT_DATE`
        );
        const total_sent_today = parseInt(todayResult.rows[0].count);

        // Total sent this week
        const weekResult = await pool.query(
            `SELECT COUNT(*) as count 
       FROM auto_reply_logs 
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`
        );
        const total_sent_week = parseInt(weekResult.rows[0].count);

        // Total sent this month
        const monthResult = await pool.query(
            `SELECT COUNT(*) as count 
       FROM auto_reply_logs 
       WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)`
        );
        const total_sent_month = parseInt(monthResult.rows[0].count);

        // By intent
        const byIntentResult = await pool.query(
            `SELECT detected_intent as name, COUNT(*) as count 
       FROM auto_reply_logs 
       WHERE detected_intent IS NOT NULL
       GROUP BY detected_intent 
       ORDER BY count DESC
       LIMIT 10`
        );
        const by_intent = byIntentResult.rows.map(row => ({
            name: row.name,
            count: parseInt(row.count)
        }));

        // Average confidence
        const avgResult = await pool.query(
            `SELECT AVG(confidence) as avg 
       FROM auto_reply_logs 
       WHERE confidence IS NOT NULL`
        );
        const avg_confidence = parseFloat(avgResult.rows[0].avg || 0);

        return {
            total_sent_today,
            total_sent_week,
            total_sent_month,
            by_intent,
            avg_confidence
        };
    }

    /**
     * Check if phone received auto-reply recently (rate limiting)
     */
    async hasRecentAutoReply(phone: string, minutesAgo: number = 5): Promise<boolean> {
        const result = await pool.query(
            `SELECT COUNT(*) as count 
       FROM auto_reply_logs 
       WHERE phone = $1 
       AND created_at >= NOW() - INTERVAL '${minutesAgo} minutes'`,
            [phone]
        );
        return parseInt(result.rows[0].count) > 0;
    }
}

export const autoReplyRepository = new AutoReplyRepository();
