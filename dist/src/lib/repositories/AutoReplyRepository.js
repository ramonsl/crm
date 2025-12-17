"use strict";
/**
 * Auto-Reply Repository
 * Data access layer for auto-reply system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoReplyRepository = exports.AutoReplyRepository = void 0;
const neonDb_1 = require("../neonDb");
class AutoReplyRepository {
    /**
     * Find all auto-replies
     */
    async findAll() {
        const result = await neonDb_1.pool.query('SELECT * FROM auto_replies ORDER BY priority DESC, name ASC');
        return result.rows;
    }
    /**
     * Find only active auto-replies
     */
    async findActive() {
        const result = await neonDb_1.pool.query('SELECT * FROM auto_replies WHERE is_active = true ORDER BY priority DESC, name ASC');
        return result.rows;
    }
    /**
     * Find auto-reply by ID
     */
    async findById(id) {
        const result = await neonDb_1.pool.query('SELECT * FROM auto_replies WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    /**
     * Create new auto-reply
     */
    async create(data) {
        var _a, _b, _c;
        const result = await neonDb_1.pool.query(`INSERT INTO auto_replies (
        name, 
        intent_description, 
        example_messages, 
        response_template, 
        is_active, 
        priority, 
        confidence_threshold
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *`, [
            data.name,
            data.intent_description,
            data.example_messages || [],
            data.response_template,
            (_a = data.is_active) !== null && _a !== void 0 ? _a : true,
            (_b = data.priority) !== null && _b !== void 0 ? _b : 0,
            (_c = data.confidence_threshold) !== null && _c !== void 0 ? _c : 0.70
        ]);
        return result.rows[0];
    }
    /**
     * Update auto-reply
     */
    async update(id, data) {
        const fields = [];
        const values = [];
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
        const result = await neonDb_1.pool.query(`UPDATE auto_replies SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`, values);
        return result.rows[0] || null;
    }
    /**
     * Delete auto-reply
     */
    async delete(id) {
        const result = await neonDb_1.pool.query('DELETE FROM auto_replies WHERE id = $1', [id]);
        return (result.rowCount || 0) > 0;
    }
    /**
     * Toggle active status
     */
    async toggleActive(id) {
        const result = await neonDb_1.pool.query('UPDATE auto_replies SET is_active = NOT is_active WHERE id = $1 RETURNING *', [id]);
        return result.rows[0] || null;
    }
    /**
     * Create auto-reply log entry
     */
    async createLog(data) {
        const result = await neonDb_1.pool.query(`INSERT INTO auto_reply_logs (
        auto_reply_id,
        phone,
        message,
        detected_intent,
        confidence,
        response_sent
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`, [
            data.auto_reply_id,
            data.phone,
            data.message,
            data.detected_intent,
            data.confidence,
            data.response_sent
        ]);
        return result.rows[0];
    }
    /**
     * Get logs for a specific phone number
     */
    async getLogsByPhone(phone, limit = 50) {
        const result = await neonDb_1.pool.query('SELECT * FROM auto_reply_logs WHERE phone = $1 ORDER BY created_at DESC LIMIT $2', [phone, limit]);
        return result.rows;
    }
    /**
     * Get recent logs
     */
    async getRecentLogs(limit = 100) {
        const result = await neonDb_1.pool.query('SELECT * FROM auto_reply_logs ORDER BY created_at DESC LIMIT $1', [limit]);
        return result.rows;
    }
    /**
     * Get statistics
     */
    async getStats() {
        // Total sent today
        const todayResult = await neonDb_1.pool.query(`SELECT COUNT(*) as count 
       FROM auto_reply_logs 
       WHERE created_at >= CURRENT_DATE`);
        const total_sent_today = parseInt(todayResult.rows[0].count);
        // Total sent this week
        const weekResult = await neonDb_1.pool.query(`SELECT COUNT(*) as count 
       FROM auto_reply_logs 
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`);
        const total_sent_week = parseInt(weekResult.rows[0].count);
        // Total sent this month
        const monthResult = await neonDb_1.pool.query(`SELECT COUNT(*) as count 
       FROM auto_reply_logs 
       WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)`);
        const total_sent_month = parseInt(monthResult.rows[0].count);
        // By intent
        const byIntentResult = await neonDb_1.pool.query(`SELECT detected_intent as name, COUNT(*) as count 
       FROM auto_reply_logs 
       WHERE detected_intent IS NOT NULL
       GROUP BY detected_intent 
       ORDER BY count DESC
       LIMIT 10`);
        const by_intent = byIntentResult.rows.map(row => ({
            name: row.name,
            count: parseInt(row.count)
        }));
        // Average confidence
        const avgResult = await neonDb_1.pool.query(`SELECT AVG(confidence) as avg 
       FROM auto_reply_logs 
       WHERE confidence IS NOT NULL`);
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
    async hasRecentAutoReply(phone, minutesAgo = 5) {
        const result = await neonDb_1.pool.query(`SELECT COUNT(*) as count 
       FROM auto_reply_logs 
       WHERE phone = $1 
       AND created_at >= NOW() - INTERVAL '${minutesAgo} minutes'`, [phone]);
        return parseInt(result.rows[0].count) > 0;
    }
}
exports.AutoReplyRepository = AutoReplyRepository;
exports.autoReplyRepository = new AutoReplyRepository();
