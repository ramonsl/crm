/**
 * YCloud Template Repository
 * 
 * Handles database operations for YCloud message templates.
 * Following Repository Pattern: Encapsulates data access logic.
 */

import { pool } from '../db';
import type { QueryParams } from '@/types/database';

/**
 * YCloud template database row
 */
export interface YCloudTemplateRow {
    id: number;
    template_name: string;
    friendly_name: string;
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    language: string;
    header_type: string | null;
    header_content: string | null;
    body_text: string;
    footer_text: string | null;
    buttons: object | null;
    variables: TemplateVariableConfig[] | null;
    status: 'draft' | 'pending' | 'approved' | 'rejected';
    ycloud_template_id: string | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Variable configuration for templates
 */
export interface TemplateVariableConfig {
    position: number;
    sample: string;
    field: string;
    description?: string;
}

/**
 * DTO for creating a template
 */
export interface CreateYCloudTemplateDto {
    template_name: string;
    friendly_name: string;
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    language?: string;
    header_type?: string;
    header_content?: string;
    body_text: string;
    footer_text?: string;
    buttons?: object;
    variables?: TemplateVariableConfig[];
}

/**
 * DTO for updating a template
 */
export interface UpdateYCloudTemplateDto {
    friendly_name?: string;
    category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    header_type?: string;
    header_content?: string;
    body_text?: string;
    footer_text?: string;
    buttons?: object;
    variables?: TemplateVariableConfig[];
    status?: 'draft' | 'pending' | 'approved' | 'rejected';
    ycloud_template_id?: string;
    rejection_reason?: string;
}

export class YCloudTemplateRepository {

    /**
     * Find all templates
     */
    async findAll(): Promise<YCloudTemplateRow[]> {
        const result = await pool.query(`
            SELECT * FROM ycloud_templates 
            ORDER BY created_at DESC
        `);
        return result.rows as YCloudTemplateRow[];
    }

    /**
     * Find all approved templates (for bulk send)
     */
    async findApproved(): Promise<YCloudTemplateRow[]> {
        const result = await pool.query(`
            SELECT * FROM ycloud_templates 
            WHERE status = 'approved'
            ORDER BY friendly_name ASC
        `);
        return result.rows as YCloudTemplateRow[];
    }

    /**
     * Find a template by ID
     */
    async findById(id: number): Promise<YCloudTemplateRow | null> {
        const result = await pool.query(
            'SELECT * FROM ycloud_templates WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Find a template by name
     */
    async findByName(templateName: string): Promise<YCloudTemplateRow | null> {
        const result = await pool.query(
            'SELECT * FROM ycloud_templates WHERE template_name = $1',
            [templateName]
        );
        return result.rows[0] || null;
    }

    /**
     * Create a new template draft
     */
    async create(dto: CreateYCloudTemplateDto): Promise<YCloudTemplateRow> {
        const result = await pool.query(`
            INSERT INTO ycloud_templates (
                template_name, friendly_name, category, language,
                header_type, header_content, body_text, footer_text,
                buttons, variables, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
            RETURNING *
        `, [
            dto.template_name,
            dto.friendly_name,
            dto.category,
            dto.language || 'pt_BR',
            dto.header_type || null,
            dto.header_content || null,
            dto.body_text,
            dto.footer_text || null,
            dto.buttons ? JSON.stringify(dto.buttons) : null,
            dto.variables ? JSON.stringify(dto.variables) : null
        ]);

        return result.rows[0] as YCloudTemplateRow;
    }

    /**
     * Update a template
     */
    async update(id: number, dto: UpdateYCloudTemplateDto): Promise<void> {
        const fields: string[] = [];
        const params: QueryParams = [];
        let paramIndex = 1;

        if (dto.friendly_name !== undefined) {
            fields.push(`friendly_name = $${paramIndex++}`);
            params.push(dto.friendly_name);
        }
        if (dto.category !== undefined) {
            fields.push(`category = $${paramIndex++}`);
            params.push(dto.category);
        }
        if (dto.header_type !== undefined) {
            fields.push(`header_type = $${paramIndex++}`);
            params.push(dto.header_type);
        }
        if (dto.header_content !== undefined) {
            fields.push(`header_content = $${paramIndex++}`);
            params.push(dto.header_content);
        }
        if (dto.body_text !== undefined) {
            fields.push(`body_text = $${paramIndex++}`);
            params.push(dto.body_text);
        }
        if (dto.footer_text !== undefined) {
            fields.push(`footer_text = $${paramIndex++}`);
            params.push(dto.footer_text);
        }
        if (dto.buttons !== undefined) {
            fields.push(`buttons = $${paramIndex++}`);
            params.push(JSON.stringify(dto.buttons));
        }
        if (dto.variables !== undefined) {
            fields.push(`variables = $${paramIndex++}`);
            params.push(JSON.stringify(dto.variables));
        }
        if (dto.status !== undefined) {
            fields.push(`status = $${paramIndex++}`);
            params.push(dto.status);
        }
        if (dto.ycloud_template_id !== undefined) {
            fields.push(`ycloud_template_id = $${paramIndex++}`);
            params.push(dto.ycloud_template_id);
        }
        if (dto.rejection_reason !== undefined) {
            fields.push(`rejection_reason = $${paramIndex++}`);
            params.push(dto.rejection_reason);
        }

        if (fields.length === 0) return;

        // Always update updated_at
        fields.push(`updated_at = NOW()`);
        params.push(id);

        const query = `
            UPDATE ycloud_templates 
            SET ${fields.join(', ')} 
            WHERE id = $${paramIndex}
        `;

        await pool.query(query, params);
    }

    /**
     * Update template status to pending (submitted for approval)
     */
    async markAsPending(id: number, yCloudTemplateId: string): Promise<void> {
        await pool.query(`
            UPDATE ycloud_templates 
            SET status = 'pending', 
                ycloud_template_id = $1,
                rejection_reason = NULL,
                updated_at = NOW()
            WHERE id = $2
        `, [yCloudTemplateId, id]);
    }

    /**
     * Update template status to approved
     */
    async markAsApproved(id: number): Promise<void> {
        await pool.query(`
            UPDATE ycloud_templates 
            SET status = 'approved',
                rejection_reason = NULL,
                updated_at = NOW()
            WHERE id = $1
        `, [id]);
    }

    /**
     * Update template status to rejected
     */
    async markAsRejected(id: number, reason: string): Promise<void> {
        await pool.query(`
            UPDATE ycloud_templates 
            SET status = 'rejected',
                rejection_reason = $1,
                updated_at = NOW()
            WHERE id = $2
        `, [reason, id]);
    }

    /**
     * Delete a template (only drafts and rejected can be deleted)
     */
    async delete(id: number): Promise<boolean> {
        const result = await pool.query(`
            DELETE FROM ycloud_templates 
            WHERE id = $1 AND status IN ('draft', 'rejected')
        `, [id]);

        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Find templates by status
     */
    async findByStatus(status: YCloudTemplateRow['status']): Promise<YCloudTemplateRow[]> {
        const result = await pool.query(`
            SELECT * FROM ycloud_templates 
            WHERE status = $1
            ORDER BY updated_at DESC
        `, [status]);
        return result.rows as YCloudTemplateRow[];
    }
}
