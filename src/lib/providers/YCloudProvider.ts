/**
 * YCloud Provider
 * 
 * Client for YCloud WhatsApp Business API.
 * Handles template message sending via YCloud's API.
 * 
 * API Docs: https://docs.ycloud.com
 * Endpoint: POST https://api.ycloud.com/v2/whatsapp/messages
 */

import type {
    IMessageProvider,
    SendResult,
    SendOptions,
    ProviderType,
    TemplateVariable
} from './IMessageProvider';
import { yCloudLogger } from '@/lib/logger';

const YCLOUD_API_BASE = 'https://api.ycloud.com/v2';

/**
 * YCloud API message request body
 */
interface YCloudMessageRequest {
    from: string;            // Phone number ID from YCloud
    to: string;              // Recipient phone number
    type: 'template' | 'text';
    template?: {
        name: string;
        language: {
            code: string;
        };
        components?: YCloudComponent[];
    };
    text?: {
        body: string;
    };
}

interface YCloudComponent {
    type: 'body' | 'header' | 'button';
    parameters: Array<{
        type: 'text' | 'image' | 'video' | 'document';
        text?: string;
        image?: { link: string };
    }>;
}

interface YCloudMessageResponse {
    id: string;
    status: string;
    error?: {
        code: string;
        message: string;
    };
}

export class YCloudProvider implements IMessageProvider {
    readonly name: ProviderType = 'ycloud';

    private apiKey: string | null = null;
    private phoneId: string | null = null;
    private wabaId: string | null = null;
    private settingsLoaded: boolean = false;

    /**
     * Load settings from database
     */
    private async loadSettings(): Promise<void> {
        if (this.settingsLoaded) return;

        try {
            const { SettingRepository } = await import('../repositories/SettingRepository');
            const settingRepo = new SettingRepository();

            const [apiKey, phoneId, wabaId] = await Promise.all([
                settingRepo.get('ycloud_api_key'),
                settingRepo.get('ycloud_phone_id'),
                settingRepo.get('ycloud_waba_id')
            ]);

            this.apiKey = apiKey;
            this.phoneId = phoneId;
            this.wabaId = wabaId;
            this.settingsLoaded = true;

            yCloudLogger.debug('YCloud settings loaded', {
                hasApiKey: !!apiKey,
                hasPhoneId: !!phoneId,
                hasWabaId: !!wabaId
            });
        } catch (error) {
            yCloudLogger.error('Failed to load YCloud settings:', error);
            throw new Error('Failed to load YCloud configuration');
        }
    }

    /**
     * Make a request to YCloud API
     */
    private async request<T>(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        body?: object
    ): Promise<T> {
        await this.loadSettings();

        if (!this.apiKey) {
            throw new Error('YCloud API key not configured');
        }

        const url = `${YCLOUD_API_BASE}${endpoint}`;

        yCloudLogger.debug(`YCloud API ${method} ${endpoint}`);

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: body ? JSON.stringify(body) : undefined
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMsg = data.error?.message || `YCloud API error: ${response.status}`;
            const errorCode = data.error?.code || 'UNKNOWN_ERROR';
            yCloudLogger.error(`YCloud API error [${errorCode}]: ${errorMsg}`);

            const error = new Error(`[YCloud ${errorCode}] ${errorMsg}`);
            error.name = 'YCloudApiError';
            throw error;
        }

        return data as T;
    }

    /**
     * Format phone number for YCloud API (requires country code)
     */
    private formatPhone(phone: string): string {
        // Remove non-numeric characters
        let cleaned = phone.replace(/\D/g, '');

        // Add Brazil country code if not present
        if (!cleaned.startsWith('55')) {
            cleaned = '55' + cleaned;
        }

        return cleaned;
    }

    /**
     * Send a text message (YCloud supports direct text only within 24h window)
     */
    async sendMessage(
        phone: string,
        message: string,
        _options?: SendOptions
    ): Promise<SendResult> {
        try {
            await this.loadSettings();

            if (!this.phoneId) {
                return {
                    success: false,
                    error: 'YCloud phone ID not configured'
                };
            }

            const request: YCloudMessageRequest = {
                from: this.phoneId,
                to: this.formatPhone(phone),
                type: 'text',
                text: {
                    body: message
                }
            };

            const result = await this.request<YCloudMessageResponse>(
                '/whatsapp/messages',
                'POST',
                request
            );

            yCloudLogger.info('Message sent via YCloud', {
                messageId: result.id,
                to: phone
            });

            return {
                success: true,
                messageId: result.id
            };
        } catch (error) {
            yCloudLogger.error('YCloud sendMessage error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to send message'
            };
        }
    }

    /**
     * Send a template message via YCloud
     */
    async sendTemplateMessage(
        phone: string,
        templateName: string,
        variables: TemplateVariable[],
        language: string = 'pt_BR'
    ): Promise<SendResult> {
        try {
            await this.loadSettings();

            if (!this.phoneId) {
                return {
                    success: false,
                    error: 'YCloud phone ID not configured'
                };
            }

            // Build components from variables
            const bodyParameters = variables
                .sort((a, b) => a.position - b.position)
                .map(v => ({
                    type: 'text' as const,
                    text: v.value
                }));

            const components: YCloudComponent[] = [];
            if (bodyParameters.length > 0) {
                components.push({
                    type: 'body',
                    parameters: bodyParameters
                });
            }

            const request: YCloudMessageRequest = {
                from: this.phoneId,
                to: this.formatPhone(phone),
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: language
                    },
                    components: components.length > 0 ? components : undefined
                }
            };

            const result = await this.request<YCloudMessageResponse>(
                '/whatsapp/messages',
                'POST',
                request
            );

            yCloudLogger.info('Template message sent via YCloud', {
                messageId: result.id,
                to: phone,
                template: templateName
            });

            return {
                success: true,
                messageId: result.id
            };
        } catch (error) {
            yCloudLogger.error('YCloud sendTemplateMessage error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to send template message'
            };
        }
    }

    /**
     * YCloud doesn't have number validation - return true
     */
    async validateNumber(_phone: string): Promise<boolean> {
        // YCloud API doesn't provide number validation
        // We assume the number is valid
        return true;
    }

    /**
     * Check if YCloud is configured and ready
     */
    async isReady(): Promise<boolean> {
        try {
            await this.loadSettings();
            return !!(this.apiKey && this.phoneId);
        } catch {
            return false;
        }
    }

    /**
     * Get WABA ID for template operations
     */
    async getWabaId(): Promise<string | null> {
        await this.loadSettings();
        return this.wabaId;
    }
}
