/**
 * WhatsApp-web.js Provider Adapter
 * 
 * Adapts the existing WhatsAppMessenger to the IMessageProvider interface.
 * Following Adapter Pattern: Wraps existing implementation.
 */

import type { IMessageProvider, SendResult, SendOptions, ProviderType } from './IMessageProvider';

export class WhatsAppJSProvider implements IMessageProvider {
    readonly name: ProviderType = 'whatsappjs';

    /**
     * Send a text message using whatsapp-web.js
     */
    async sendMessage(
        phone: string,
        message: string,
        options?: SendOptions
    ): Promise<SendResult> {
        try {
            // Dynamic import to avoid circular dependency
            const { sendMessage } = await import('../whatsapp');

            const result = await sendMessage(
                phone,
                message,
                options?.mediaUrl,
                options?.mediaType
            );

            if (result.success) {
                return {
                    success: true,
                    messageId: result.id
                };
            }

            return {
                success: false,
                error: result.error || 'Failed to send message'
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Template messages are not supported by whatsapp-web.js
     * We use regular messages with variable substitution instead
     */
    async sendTemplateMessage(): Promise<SendResult> {
        return {
            success: false,
            error: 'Template messages are not supported by WhatsAppJS provider. Use sendMessage instead.'
        };
    }

    /**
     * Validate if a phone number is registered on WhatsApp
     */
    async validateNumber(phone: string): Promise<boolean> {
        try {
            const { validateWhatsAppNumber } = await import('../whatsapp');
            const result = await validateWhatsAppNumber(phone);
            return result !== null;
        } catch {
            return false;
        }
    }

    /**
     * Check if the WhatsApp client is ready
     */
    async isReady(): Promise<boolean> {
        try {
            const { isClientReady } = await import('../whatsapp');
            return await isClientReady();
        } catch {
            return false;
        }
    }
}
