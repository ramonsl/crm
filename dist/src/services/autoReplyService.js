"use strict";
/**
 * Auto-Reply Service
 * Main business logic for auto-reply system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoReplyService = exports.AutoReplyService = void 0;
const AutoReplyRepository_1 = require("@/lib/repositories/AutoReplyRepository");
const intentDetectionService_1 = require("./intentDetectionService");
class AutoReplyService {
    constructor() {
        this.isEnabled = true;
        this.blacklistedPhones = new Set();
        this.rateLimitMinutes = 5; // Don't send auto-reply to same phone within 5 minutes
    }
    /**
     * Process incoming message and send auto-reply if applicable
     * Returns the response text if one should be sent, null otherwise
     */
    async processIncomingMessage(phone, message) {
        try {
            // Check if auto-reply is globally enabled
            if (!this.isEnabled) {
                console.log('[AutoReply] Auto-reply is disabled globally');
                return null;
            }
            // Check blacklist
            if (this.isBlacklisted(phone)) {
                console.log('[AutoReply] Phone is blacklisted:', phone);
                return null;
            }
            // Check rate limiting
            const hasRecent = await AutoReplyRepository_1.autoReplyRepository.hasRecentAutoReply(phone, this.rateLimitMinutes);
            if (hasRecent) {
                console.log('[AutoReply] Rate limit: phone received auto-reply recently:', phone);
                return null;
            }
            // Get active auto-replies
            const activeReplies = await AutoReplyRepository_1.autoReplyRepository.findActive();
            if (activeReplies.length === 0) {
                console.log('[AutoReply] No active auto-replies configured');
                return null;
            }
            // Detect intent
            console.log('[AutoReply] Detecting intent for message:', message.substring(0, 50));
            const detection = await intentDetectionService_1.intentDetectionService.detectIntent(message, activeReplies);
            if (!detection) {
                console.log('[AutoReply] No intent detected');
                await this.logNoMatch(phone, message);
                return null;
            }
            // Find the matching auto-reply
            const autoReply = activeReplies.find(r => r.id === detection.autoReplyId);
            if (!autoReply) {
                console.log('[AutoReply] Auto-reply not found for detected intent');
                return null;
            }
            // Check confidence threshold
            if (detection.confidence < autoReply.confidence_threshold) {
                console.log('[AutoReply] Confidence too low:', {
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
            console.log('[AutoReply] Sending response:', {
                phone,
                intent: detection.intent,
                confidence: detection.confidence,
                response: response.substring(0, 50)
            });
            // Log the auto-reply
            await AutoReplyRepository_1.autoReplyRepository.createLog({
                auto_reply_id: autoReply.id,
                phone,
                message,
                detected_intent: detection.intent,
                confidence: detection.confidence,
                response_sent: response
            });
            // Return the response to be sent by WhatsApp handler
            return response;
        }
        catch (error) {
            console.error('[AutoReply] Error processing message:', error);
            throw error;
        }
    }
    /**
     * Render template with variables
     */
    renderTemplate(template, context) {
        let rendered = template;
        // Replace variables
        const variables = {
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
    extractNameFromPhone(phone) {
        // This will be enhanced to lookup from contacts table
        return 'Cliente';
    }
    /**
     * Log when no intent matches
     */
    async logNoMatch(phone, message) {
        await AutoReplyRepository_1.autoReplyRepository.createLog({
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
    async logLowConfidence(phone, message, intent, confidence) {
        await AutoReplyRepository_1.autoReplyRepository.createLog({
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
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log('[AutoReply] Auto-reply globally', enabled ? 'enabled' : 'disabled');
    }
    /**
     * Check if auto-reply is enabled
     */
    isAutoReplyEnabled() {
        return this.isEnabled;
    }
    /**
     * Add phone to blacklist
     */
    addToBlacklist(phone) {
        this.blacklistedPhones.add(phone);
        console.log('[AutoReply] Added to blacklist:', phone);
    }
    /**
     * Remove phone from blacklist
     */
    removeFromBlacklist(phone) {
        this.blacklistedPhones.delete(phone);
        console.log('[AutoReply] Removed from blacklist:', phone);
    }
    /**
     * Check if phone is blacklisted
     */
    isBlacklisted(phone) {
        return this.blacklistedPhones.has(phone);
    }
    /**
     * Set rate limit duration in minutes
     */
    setRateLimitMinutes(minutes) {
        this.rateLimitMinutes = minutes;
        console.log('[AutoReply] Rate limit set to', minutes, 'minutes');
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
exports.AutoReplyService = AutoReplyService;
exports.autoReplyService = new AutoReplyService();
