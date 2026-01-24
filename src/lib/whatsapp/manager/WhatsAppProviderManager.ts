/**
 * WhatsApp Provider Manager
 * 
 * Manages DUAL WhatsApp connections:
 * 1. Official Provider (YCloud) - Always active if configured
 * 2. Web Provider (Baileys/WWebJS) - Active via QR Code
 * 
 * Implements the Singleton pattern.
 */

import { IWhatsAppProvider } from '../IWhatsAppProvider';
import { YCloudAdapter } from '../adapters/YCloudAdapter';
import { BaileysAdapter } from '../adapters/BaileysAdapter';
import { WWebJSAdapter } from '../adapters/WWebJSAdapter';
import { whatsappLogger } from '@/lib/logger';
import { queryOne } from '@/lib/db';

export type WebProviderType = 'baileys' | 'wwebjs';

// Global scope for singleton persistence
declare global {
    var _providerManagerInstance: WhatsAppProviderManager | null;
}

export class WhatsAppProviderManager {
    private officialProvider: YCloudAdapter | null = null;
    private webProvider: IWhatsAppProvider | null = null;
    private currentWebProviderType: WebProviderType | null = null; // Default to null until initialized

    private constructor() { }

    public getWebProviderType(): WebProviderType | null {
        return this.currentWebProviderType;
    }

    public static getInstance(): WhatsAppProviderManager {
        if (!global._providerManagerInstance) {
            global._providerManagerInstance = new WhatsAppProviderManager();
        }
        return global._providerManagerInstance;
    }

    public static reset(): void {
        global._providerManagerInstance = null;
    }

    /**
     * Initializes providers based on configuration
     */
    public async initialize(): Promise<void> {
        whatsappLogger.info('[ProviderManager] Initializing providers...');

        // 1. Initialize Official Provider (YCloud)
        await this.initOfficialProvider();

        // 2. Initialize Web Provider (Baileys/WWebJS)
        await this.initWebProvider();
    }

    /**
     * Get Official YCloud Provider
     */
    public getOfficialProvider(): YCloudAdapter {
        if (!this.officialProvider) {
            this.officialProvider = new YCloudAdapter();
            // Start initialization in background (don't await to avoid blocking)
            this.officialProvider.initialize().catch(err => {
                whatsappLogger.error('[ProviderManager] Failed to auto-init YCloud:', err);
            });
        }
        return this.officialProvider;
    }

    /**
     * Get Web Provider (Baileys or WWebJS)
     */
    public async getWebProvider(): Promise<IWhatsAppProvider> {
        if (!this.webProvider) {
            await this.initWebProvider();
        }
        return this.webProvider!;
    }

    /**
     * Get Specific Provider by Type
     * @param type 'ycloud' or 'baileys'/'wwebjs'
     */
    public async getProvider(type: 'ycloud' | WebProviderType): Promise<IWhatsAppProvider> {
        if (type === 'ycloud') {
            return this.getOfficialProvider();
        }
        // Force switch if requested type differs from current
        if (type !== this.currentWebProviderType) {
            await this.switchWebProvider(type);
        }
        return this.getWebProvider();
    }

    /**
     * Returns true if Official Provider is ready
     */
    public async isOfficialReady(): Promise<boolean> {
        return this.officialProvider ? this.officialProvider.isReady() : false;
    }

    /**
     * Returns true if Web Provider is ready
     */
    public async isWebReady(): Promise<boolean> {
        return this.webProvider ? this.webProvider.isReady() : false;
    }

    /**
     * Checks if any provider is currently initialized (internal use)
     */
    public hasActiveProvider(): boolean {
        return !!(this.officialProvider || this.webProvider);
    }

    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================

    private async initOfficialProvider() {
        if (!this.officialProvider) {
            this.officialProvider = new YCloudAdapter();
            try {
                await this.officialProvider.initialize();
                whatsappLogger.info('[ProviderManager] YCloud Provider initialized');
            } catch (e) {
                whatsappLogger.warn('[ProviderManager] YCloud init warning (might need API Key):', e);
            }
        }
    }

    private async initWebProvider() {
        // Load preference from DB
        const persistedType = await this.loadWebProviderPreference();
        this.currentWebProviderType = persistedType || 'baileys';

        if (!this.webProvider) {
            whatsappLogger.info(`[ProviderManager] Initializing Web Provider: ${this.currentWebProviderType}`);
            if (this.currentWebProviderType === 'wwebjs') {
                this.webProvider = new WWebJSAdapter();
            } else {
                this.webProvider = new BaileysAdapter();
            }
        }
    }

    public resetWebProvider(): void {
        this.webProvider = null;
        this.currentWebProviderType = null;
    }

    private async switchWebProvider(type: WebProviderType) {
        if (this.currentWebProviderType === type && this.webProvider) return;

        whatsappLogger.info(`[ProviderManager] Switching Web Provider to ${type}`);

        // Logout current
        if (this.webProvider) {
            try {
                await this.webProvider.logout();
            } catch (e) {
                whatsappLogger.warn('Error logging out previous provider:', e);
            }
            this.webProvider = null;
        }

        this.currentWebProviderType = type;
        await this.persistWebProviderPreference(type);
        await this.initWebProvider();
    }

    private async loadWebProviderPreference(): Promise<WebProviderType | null> {
        try {
            const row = await queryOne<{ value: string }>(
                "SELECT value FROM settings WHERE key = 'whatsapp_web_provider'"
            );
            if (row && (row.value === 'baileys' || row.value === 'wwebjs')) {
                return row.value as WebProviderType;
            }
        } catch (e) {
            whatsappLogger.warn('Failed to load web provider preference', e);
        }
        return null;
    }

    private async persistWebProviderPreference(type: WebProviderType) {
        try {
            // We use a new key 'whatsapp_web_provider' to avoid conflict with legacy 'whatsapp_provider'
            // pending migration updates if needed.
            // For compatibility with legacy 'whatsapp_provider' check, we might want to update both 
            // or move strictly to this new key. 
            // TODO: Consolidation in future refactor.
            await import('@/lib/db').then(db => db.execute(
                `INSERT INTO settings (key, value) VALUES ('whatsapp_web_provider', $1) 
                  ON CONFLICT (key) DO UPDATE SET value = $1`,
                [type]
            ));
        } catch (e) {
            whatsappLogger.error('Failed to persist web provider preference', e);
        }
    }
}
