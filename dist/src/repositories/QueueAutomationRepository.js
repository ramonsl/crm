"use strict";
/**
 * Queue Automation Repository - Data access layer
 *
 * Follows SRP: Only handles data persistence for queue automation.
 * Follows DIP: Defines interface for dependency injection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueAutomationRepository = exports.NeonQueueAutomationRepository = void 0;
const db_1 = require("../lib/db");
/**
 * PostgreSQL implementation of queue automation repository
 */
class NeonQueueAutomationRepository {
    /**
     * Get current automation configuration
     */
    async getConfig() {
        const result = await db_1.pool.query('SELECT * FROM queue_automation_config LIMIT 1');
        if (result.rows.length === 0) {
            return null;
        }
        const row = result.rows[0];
        return this.mapConfigRowToEntity(row);
    }
    /**
     * Update automation configuration
     */
    async updateConfig(config) {
        const updates = [];
        const values = [];
        let paramCount = 0;
        if (config.templateId !== undefined) {
            paramCount++;
            updates.push(`template_id = $${paramCount}`);
            values.push(config.templateId);
        }
        if (config.messageType !== undefined) {
            paramCount++;
            updates.push(`message_type = $${paramCount}`);
            values.push(config.messageType);
        }
        if (config.isActive !== undefined) {
            paramCount++;
            updates.push(`is_active = $${paramCount}`);
            values.push(config.isActive);
        }
        if (config.startHour !== undefined) {
            paramCount++;
            updates.push(`start_hour = $${paramCount}`);
            values.push(config.startHour);
        }
        if (config.endHour !== undefined) {
            paramCount++;
            updates.push(`end_hour = $${paramCount}`);
            values.push(config.endHour);
        }
        if (config.targetStatus !== undefined) {
            paramCount++;
            updates.push(`target_status = $${paramCount}`);
            values.push(config.targetStatus);
        }
        if (updates.length === 0) {
            return;
        }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        await db_1.pool.query(`UPDATE queue_automation_config SET ${updates.join(', ')} WHERE id = 1`, values);
    }
    /**
     * Log a send attempt
     */
    async logSend(leadCpf, templateId, success, errorMessage) {
        await db_1.pool.query(`INSERT INTO queue_automation_log (lead_cpf, template_id, success, error_message)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (lead_cpf) DO UPDATE SET
                 template_id = EXCLUDED.template_id,
                 sent_at = CURRENT_TIMESTAMP,
                 success = EXCLUDED.success,
                 error_message = EXCLUDED.error_message`, [leadCpf, templateId, success, errorMessage || null]);
    }
    /**
     * Check if a lead has already been contacted by this automation
     */
    async hasBeenContacted(leadCpf) {
        const result = await db_1.pool.query('SELECT 1 FROM queue_automation_log WHERE lead_cpf = $1 AND success = true LIMIT 1', [leadCpf]);
        return result.rows.length > 0;
    }
    /**
     * Get log statistics
     */
    async getLogStats() {
        const result = await db_1.pool.query(`SELECT 
                COUNT(*) as total,
                MAX(sent_at) as last_sent
             FROM queue_automation_log
             WHERE success = true`);
        const row = result.rows[0];
        return {
            totalSent: parseInt(row.total, 10) || 0,
            lastSentAt: row.last_sent || null
        };
    }
    /**
     * Map database row to entity
     */
    mapConfigRowToEntity(row) {
        return {
            id: row.id,
            templateId: row.template_id,
            targetStatus: row.target_status,
            messageType: row.message_type,
            isActive: row.is_active,
            startHour: row.start_hour,
            endHour: row.end_hour,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}
exports.NeonQueueAutomationRepository = NeonQueueAutomationRepository;
// Singleton instance
exports.queueAutomationRepository = new NeonQueueAutomationRepository();
