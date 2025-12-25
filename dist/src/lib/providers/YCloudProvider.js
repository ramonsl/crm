"use strict";
/**
 * YCloud Provider
 *
 * Client for YCloud WhatsApp Business API.
 * Handles template message sending via YCloud's API.
 *
 * API Docs: https://docs.ycloud.com
 * Endpoint: POST https://api.ycloud.com/v2/whatsapp/messages
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.YCloudProvider = void 0;
const logger_1 = require("../../lib/logger");
const YCLOUD_API_BASE = 'https://api.ycloud.com/v2';
class YCloudProvider {
    constructor() {
        this.name = 'ycloud';
        this.apiKey = null;
        this.phoneId = null;
        this.wabaId = null;
        this.settingsLoaded = false;
    }
    /**
     * Load settings from database
     */
    async loadSettings() {
        if (this.settingsLoaded)
            return;
        try {
            const { SettingRepository } = await Promise.resolve().then(() => __importStar(require('../repositories/SettingRepository')));
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
            logger_1.yCloudLogger.debug('YCloud settings loaded', {
                hasApiKey: !!apiKey,
                hasPhoneId: !!phoneId,
                hasWabaId: !!wabaId
            });
        }
        catch (error) {
            logger_1.yCloudLogger.error('Failed to load YCloud settings:', error);
            throw new Error('Failed to load YCloud configuration');
        }
    }
    /**
     * Make a request to YCloud API
     */
    async request(endpoint, method = 'GET', body) {
        var _a, _b;
        await this.loadSettings();
        if (!this.apiKey) {
            throw new Error('YCloud API key not configured');
        }
        const url = `${YCLOUD_API_BASE}${endpoint}`;
        logger_1.yCloudLogger.debug(`YCloud API ${method} ${endpoint}`);
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
            const errorMsg = ((_a = data.error) === null || _a === void 0 ? void 0 : _a.message) || `YCloud API error: ${response.status}`;
            const errorCode = ((_b = data.error) === null || _b === void 0 ? void 0 : _b.code) || 'UNKNOWN_ERROR';
            logger_1.yCloudLogger.error(`YCloud API error [${errorCode}]: ${errorMsg}`);
            const error = new Error(`[YCloud ${errorCode}] ${errorMsg}`);
            error.name = 'YCloudApiError';
            throw error;
        }
        return data;
    }
    /**
     * Format phone number for YCloud API (requires country code)
     */
    formatPhone(phone) {
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
    async sendMessage(phone, message, _options) {
        try {
            await this.loadSettings();
            if (!this.phoneId) {
                return {
                    success: false,
                    error: 'YCloud phone ID not configured'
                };
            }
            const request = {
                from: this.phoneId,
                to: this.formatPhone(phone),
                type: 'text',
                text: {
                    body: message
                }
            };
            const result = await this.request('/whatsapp/messages', 'POST', request);
            logger_1.yCloudLogger.info('Message sent via YCloud', {
                messageId: result.id,
                to: phone
            });
            return {
                success: true,
                messageId: result.id
            };
        }
        catch (error) {
            logger_1.yCloudLogger.error('YCloud sendMessage error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to send message'
            };
        }
    }
    /**
     * Send a template message via YCloud
     */
    async sendTemplateMessage(phone, templateName, variables, language = 'pt_BR') {
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
                type: 'text',
                text: v.value
            }));
            const components = [];
            if (bodyParameters.length > 0) {
                components.push({
                    type: 'body',
                    parameters: bodyParameters
                });
            }
            const request = {
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
            const result = await this.request('/whatsapp/messages', 'POST', request);
            logger_1.yCloudLogger.info('Template message sent via YCloud', {
                messageId: result.id,
                to: phone,
                template: templateName
            });
            return {
                success: true,
                messageId: result.id
            };
        }
        catch (error) {
            logger_1.yCloudLogger.error('YCloud sendTemplateMessage error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to send template message'
            };
        }
    }
    /**
     * YCloud doesn't have number validation - return true
     */
    async validateNumber(_phone) {
        // YCloud API doesn't provide number validation
        // We assume the number is valid
        return true;
    }
    /**
     * Check if YCloud is configured and ready
     */
    async isReady() {
        try {
            await this.loadSettings();
            return !!(this.apiKey && this.phoneId);
        }
        catch (_a) {
            return false;
        }
    }
    /**
     * Get WABA ID for template operations
     */
    async getWabaId() {
        await this.loadSettings();
        return this.wabaId;
    }
}
exports.YCloudProvider = YCloudProvider;
