/**
 * Auto-Reply Service
 * Main business logic for auto-reply system
 */

import { autoReplyRepository } from '@/lib/repositories/AutoReplyRepository';
import { intentDetectionService } from './intentDetectionService';
import { autoReplyLogger } from '@/lib/logger';
import type { IAutoReplyService, AutoReplyConfig } from './interfaces';

// Re-export types for backwards compatibility
export type { AutoReplyConfig };

export class AutoReplyService implements IAutoReplyService {
    private isEnabled: boolean = true;
    private blacklistedPhones: Set<string> = new Set();
    private rateLimitMinutes: number = 5; // Don't send auto-reply to same phone within 5 minutes

    /**
     * Process incoming message and send auto-reply if applicable
     * Returns the response text if one should be sent, null otherwise
     */
    async processIncomingMessage(phone: string, message: string): Promise<string | null> {
        try {
            // Check if auto-reply is globally enabled
            if (!this.isEnabled) {
                autoReplyLogger.debug('Auto-reply is disabled globally');
                return null;
            }

            // Check blacklist
            if (this.isBlacklisted(phone)) {
                autoReplyLogger.debug(`Phone is blacklisted: ${phone}`);
                return null;
            }

            // Check rate limiting
            const hasRecent = await autoReplyRepository.hasRecentAutoReply(
                phone,
                this.rateLimitMinutes
            );
            if (hasRecent) {
                autoReplyLogger.debug(`Rate limit: phone received auto-reply recently: ${phone}`);
                return null;
            }

            // Get active auto-replies
            const activeReplies = await autoReplyRepository.findActive();
            if (activeReplies.length === 0) {
                autoReplyLogger.debug('No active auto-replies configured');
                return null;
            }

            // Detect intent
            autoReplyLogger.debug(`Detecting intent for message: ${message.substring(0, 50)}`);
            const detection = await intentDetectionService.detectIntent(message, activeReplies);

            if (!detection) {
                autoReplyLogger.debug('No intent detected');
                await this.logNoMatch(phone, message);
                return null;
            }

            // Find the matching auto-reply
            const autoReply = activeReplies.find(r => r.id === detection.autoReplyId);
            if (!autoReply) {
                autoReplyLogger.warn('Auto-reply not found for detected intent');
                return null;
            }

            // Check confidence threshold
            if (detection.confidence < autoReply.confidence_threshold) {
                autoReplyLogger.debug('Confidence too low', {
                    confidence: detection.confidence,
                    threshold: autoReply.confidence_threshold
                });
                await this.logLowConfidence(phone, message, detection.intent, detection.confidence);
                return null;
            }

            // Render response template with variables
            const response = this.renderTemplate(autoReply.response_template, {
                phone,
                message
            });

            // Send the response (this will be handled by WhatsApp integration)
            autoReplyLogger.info('Sending response', {
                phone,
                intent: detection.intent,
                confidence: detection.confidence,
                response: response.substring(0, 50)
            });

            // Log the auto-reply
            await autoReplyRepository.createLog({
                auto_reply_id: autoReply.id,
                phone,
                message,
                detected_intent: detection.intent,
                confidence: detection.confidence,
                response_sent: response
            });

            // Return the response to be sent by WhatsApp handler
            return response;
        } catch (error) {
            autoReplyLogger.error('Error processing message:', error);
            throw error;
        }
    }

    /**
     * Render template with variables
     */
    renderTemplate(
        template: string,
        context: {
            phone: string;
            message: string;
            name?: string;
        }
    ): string {
        let rendered = template;

        // Replace variables
        const variables: Record<string, string> = {
            phone: context.phone,
            name: context.name || this.extractNameFromPhone(context.phone),
            date: new Date().toLocaleDateString('pt-BR'),
            time: new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            }),
            day: new Date().toLocaleDateString('pt-BR', { weekday: 'long' })
        };

        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            rendered = rendered.replace(regex, value);
        });

        return rendered;
    }

    /**
     * Extract name from phone (placeholder - will be enhanced with DB lookup)
     */
    private extractNameFromPhone(phone: string): string {
        // This will be enhanced to lookup from contacts table
        return 'Cliente';
    }

    /**
     * Log when no intent matches
     */
    private async logNoMatch(phone: string, message: string): Promise<void> {
        await autoReplyRepository.createLog({
            auto_reply_id: null,
            phone,
            message,
            detected_intent: null,
            confidence: null,
            response_sent: null
        });
    }

    /**
     * Log when confidence is too low
     */
    private async logLowConfidence(
        phone: string,
        message: string,
        intent: string,
        confidence: number
    ): Promise<void> {
        await autoReplyRepository.createLog({
            auto_reply_id: null,
            phone,
            message,
            detected_intent: intent,
            confidence,
            response_sent: null
        });
    }

    /**
     * Enable/disable auto-reply globally
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        autoReplyLogger.info(`Auto-reply globally ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if auto-reply is enabled
     */
    isAutoReplyEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Add phone to blacklist
     */
    addToBlacklist(phone: string): void {
        this.blacklistedPhones.add(phone);
        autoReplyLogger.info(`Added to blacklist: ${phone}`);
    }

    /**
     * Remove phone from blacklist
     */
    removeFromBlacklist(phone: string): void {
        this.blacklistedPhones.delete(phone);
        autoReplyLogger.info(`Removed from blacklist: ${phone}`);
    }

    /**
     * Check if phone is blacklisted
     */
    isBlacklisted(phone: string): boolean {
        return this.blacklistedPhones.has(phone);
    }

    /**
     * Set rate limit duration in minutes
     */
    setRateLimitMinutes(minutes: number): void {
        this.rateLimitMinutes = minutes;
        autoReplyLogger.info(`Rate limit set to ${minutes} minutes`);
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return {
            isEnabled: this.isEnabled,
            rateLimitMinutes: this.rateLimitMinutes,
            blacklistedCount: this.blacklistedPhones.size
        };
    }
}

export const autoReplyService = new AutoReplyService();
