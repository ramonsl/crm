/**
 * Template History Service - Business logic for template tracking
 * 
 * Follows SRP: Single responsibility of managing template history
 */

import type { ITemplateHistoryRepository, TemplateHistoryEntry } from '@/repositories/templateHistoryRepository';

export interface TemplateSentEvent {
    phone: string;
    templateName: string;
    templateContent: string;
    success: boolean;
    errorMessage?: string;
}

export class TemplateHistoryService {
    constructor(
        private repository: ITemplateHistoryRepository
    ) { }

    /**
     * Record a template being sent to a contact
     */
    async recordTemplateSent(event: TemplateSentEvent): Promise<void> {
        console.log(`[TemplateHistory] Recording: ${event.templateName} → ${event.phone}`);

        try {
            // Save to history table
            await this.repository.saveHistory({
                phone: event.phone,
                template_name: event.templateName,
                template_content: event.templateContent,
                sent_at: new Date().toISOString(),
                success: event.success,
                error_message: event.errorMessage
            });

            // Update last template in leads table (only if successful)
            if (event.success) {
                await this.repository.updateLastTemplate(
                    event.phone,
                    event.templateName
                );
            }

            console.log(`[TemplateHistory] ✅ Recorded successfully`);
        } catch (error) {
            console.error('[TemplateHistory] ❌ Failed to record:', error);
            throw error;
        }
    }

    /**
     * Get template history for a phone number
     */
    async getPhoneHistory(phone: string, limit: number = 50): Promise<TemplateHistoryEntry[]> {
        console.log(`[TemplateHistory] Fetching history for ${phone}`);

        try {
            const history = await this.repository.findByPhone(phone, limit);
            console.log(`[TemplateHistory] Found ${history.length} entries`);
            return history;
        } catch (error) {
            console.error('[TemplateHistory] ❌ Failed to fetch:', error);
            throw error;
        }
    }

    /**
     * Get the last template sent to a phone
     */
    async getLastTemplateSent(phone: string): Promise<string | null> {
        try {
            return await this.repository.getLastTemplateSent(phone);
        } catch (error) {
            console.error('[TemplateHistory] ❌ Failed to get last template:', error);
            return null;
        }
    }
}
