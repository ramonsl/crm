/**
 * YCloud Template Service
 * 
 * Business logic for YCloud template management:
 * - Create template drafts
 * - Submit templates to YCloud API for approval
 * - Sync template statuses from YCloud
 * 
 * Following SRP: Only handles template business logic.
 */

import {
    YCloudTemplateRepository,
    type CreateYCloudTemplateDto,
    type UpdateYCloudTemplateDto,
    type YCloudTemplateRow
} from '@/lib/repositories/YCloudTemplateRepository';
import { SettingRepository } from '@/lib/repositories/SettingRepository';
import { yCloudLogger } from '@/lib/logger';

const YCLOUD_API_BASE = 'https://api.ycloud.com/v2';

/**
 * YCloud template API response
 */
interface YCloudTemplateResponse {
    id: string;
    name: string;
    status: string;
    rejectedReason?: string;
}

/**
 * YCloud template list response
 */
interface YCloudTemplateListResponse {
    items: YCloudTemplateResponse[];
    total: number;
}

/**
 * Result of a service operation
 */
export interface ServiceResult<T = void> {
    success: boolean;
    data?: T;
    error?: string;
}

export class YCloudTemplateService {
    private repository: YCloudTemplateRepository;
    private settingRepo: SettingRepository;

    constructor() {
        this.repository = new YCloudTemplateRepository();
        this.settingRepo = new SettingRepository();
    }

    /**
     * Make a request to YCloud API
     */
    private async yCloudRequest<T>(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        body?: object
    ): Promise<T> {
        const apiKey = await this.settingRepo.get('ycloud_api_key');

        if (!apiKey) {
            throw new Error('YCloud API key not configured');
        }

        const url = `${YCLOUD_API_BASE}${endpoint}`;

        yCloudLogger.debug(`YCloud API ${method} ${endpoint}`);

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: body ? JSON.stringify(body) : undefined
        });

        const data = await response.json();

        if (!response.ok) {
            yCloudLogger.error('YCloud API error:', data);
            throw new Error(data.error?.message || `YCloud API error: ${response.status}`);
        }

        return data as T;
    }

    /**
     * List all templates from local database
     */
    async listTemplates(): Promise<YCloudTemplateRow[]> {
        return this.repository.findAll();
    }

    /**
     * List only approved templates (for bulk send)
     */
    async listApprovedTemplates(): Promise<YCloudTemplateRow[]> {
        return this.repository.findApproved();
    }

    /**
     * Get a template by ID
     */
    async getTemplate(id: number): Promise<YCloudTemplateRow | null> {
        return this.repository.findById(id);
    }

    /**
     * Create a new template draft
     */
    async createDraft(dto: CreateYCloudTemplateDto): Promise<ServiceResult<YCloudTemplateRow>> {
        try {
            // Validate template name format (snake_case, lowercase)
            const templateNameRegex = /^[a-z][a-z0-9_]*$/;
            if (!templateNameRegex.test(dto.template_name)) {
                return {
                    success: false,
                    error: 'Template name must be lowercase with underscores only (e.g., welcome_message)'
                };
            }

            // Check for duplicate name
            const existing = await this.repository.findByName(dto.template_name);
            if (existing) {
                return {
                    success: false,
                    error: 'A template with this name already exists'
                };
            }

            const template = await this.repository.create(dto);

            yCloudLogger.info('Template draft created:', template.template_name);

            return {
                success: true,
                data: template
            };
        } catch (error) {
            yCloudLogger.error('Error creating template draft:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create template draft'
            };
        }
    }

    /**
     * Update a template draft
     */
    async updateDraft(id: number, dto: UpdateYCloudTemplateDto): Promise<ServiceResult> {
        try {
            const template = await this.repository.findById(id);

            if (!template) {
                return { success: false, error: 'Template not found' };
            }

            if (template.status !== 'draft' && template.status !== 'rejected') {
                return {
                    success: false,
                    error: 'Only draft or rejected templates can be edited'
                };
            }

            await this.repository.update(id, dto);

            yCloudLogger.info('Template draft updated:', template.template_name);

            return { success: true };
        } catch (error) {
            yCloudLogger.error('Error updating template draft:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update template draft'
            };
        }
    }

    /**
     * Submit a template to YCloud for approval
     */
    async submitForApproval(id: number): Promise<ServiceResult<string>> {
        try {
            const template = await this.repository.findById(id);

            if (!template) {
                return { success: false, error: 'Template not found' };
            }

            if (template.status !== 'draft' && template.status !== 'rejected') {
                return {
                    success: false,
                    error: 'Only draft or rejected templates can be submitted'
                };
            }

            // Get WABA ID
            const wabaId = await this.settingRepo.get('ycloud_waba_id');
            if (!wabaId) {
                return { success: false, error: 'YCloud WABA ID not configured' };
            }

            // Build YCloud template components
            const components: object[] = [];

            // Header
            if (template.header_type && template.header_type !== 'none') {
                components.push({
                    type: 'HEADER',
                    format: template.header_type.toUpperCase(),
                    text: template.header_type === 'text' ? template.header_content : undefined,
                    example: template.header_type !== 'text' ? { header_handle: [template.header_content] } : undefined
                });
            }

            // Body
            const bodyComponent: {
                type: string;
                text: string;
                example?: { body_text: string[][] };
            } = {
                type: 'BODY',
                text: template.body_text
            };

            // Add example values for variables
            if (template.variables && template.variables.length > 0) {
                const samples = template.variables
                    .sort((a, b) => a.position - b.position)
                    .map(v => v.sample);
                bodyComponent.example = { body_text: [samples] };
            }

            components.push(bodyComponent);

            // Footer
            if (template.footer_text) {
                components.push({
                    type: 'FOOTER',
                    text: template.footer_text
                });
            }

            // Buttons
            if (template.buttons && Array.isArray(template.buttons)) {
                components.push({
                    type: 'BUTTONS',
                    buttons: template.buttons
                });
            }

            // Submit to YCloud
            const yCloudPayload = {
                wabaId,
                name: template.template_name,
                language: template.language,
                category: template.category,
                components
            };

            yCloudLogger.debug('Submitting template to YCloud:', yCloudPayload);

            const response = await this.yCloudRequest<YCloudTemplateResponse>(
                '/whatsapp/templates',
                'POST',
                yCloudPayload
            );

            // Update local template with YCloud ID
            await this.repository.markAsPending(id, response.id);

            yCloudLogger.info('Template submitted for approval:', template.template_name, response.id);

            return {
                success: true,
                data: response.id
            };
        } catch (error) {
            yCloudLogger.error('Error submitting template:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to submit template'
            };
        }
    }

    /**
     * Sync template statuses from YCloud
     */
    async syncStatuses(): Promise<ServiceResult<{ updated: number; errors: number }>> {
        try {
            const wabaId = await this.settingRepo.get('ycloud_waba_id');
            if (!wabaId) {
                return { success: false, error: 'YCloud WABA ID not configured' };
            }

            // Get templates that need syncing (pending)
            const pendingTemplates = await this.repository.findByStatus('pending');

            if (pendingTemplates.length === 0) {
                return { success: true, data: { updated: 0, errors: 0 } };
            }

            // Fetch all templates from YCloud
            const response = await this.yCloudRequest<YCloudTemplateListResponse>(
                `/whatsapp/templates?wabaId=${wabaId}&limit=100`
            );

            let updated = 0;
            let errors = 0;

            for (const localTemplate of pendingTemplates) {
                if (!localTemplate.ycloud_template_id) continue;

                const yCloudTemplate = response.items.find(
                    t => t.id === localTemplate.ycloud_template_id
                );

                if (!yCloudTemplate) {
                    yCloudLogger.warn('Template not found in YCloud:', localTemplate.template_name);
                    continue;
                }

                try {
                    const yCloudStatus = yCloudTemplate.status.toLowerCase();

                    if (yCloudStatus === 'approved') {
                        await this.repository.markAsApproved(localTemplate.id);
                        yCloudLogger.info('Template approved:', localTemplate.template_name);
                        updated++;
                    } else if (yCloudStatus === 'rejected') {
                        await this.repository.markAsRejected(
                            localTemplate.id,
                            yCloudTemplate.rejectedReason || 'Rejected by Meta'
                        );
                        yCloudLogger.warn('Template rejected:', localTemplate.template_name);
                        updated++;
                    }
                    // Still pending - no update needed
                } catch (updateError) {
                    yCloudLogger.error('Error updating template status:', updateError);
                    errors++;
                }
            }

            yCloudLogger.info(`Template sync complete: ${updated} updated, ${errors} errors`);

            return {
                success: true,
                data: { updated, errors }
            };
        } catch (error) {
            yCloudLogger.error('Error syncing templates:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to sync templates'
            };
        }
    }

    /**
     * Delete a template (only drafts and rejected)
     */
    async deleteTemplate(id: number): Promise<ServiceResult> {
        try {
            const deleted = await this.repository.delete(id);

            if (!deleted) {
                return {
                    success: false,
                    error: 'Template not found or cannot be deleted (only drafts and rejected templates can be deleted)'
                };
            }

            yCloudLogger.info('Template deleted:', id);

            return { success: true };
        } catch (error) {
            yCloudLogger.error('Error deleting template:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete template'
            };
        }
    }
}

// Default singleton instance
export const yCloudTemplateService = new YCloudTemplateService();
