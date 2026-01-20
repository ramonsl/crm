/**
 * WhatsApp Provider Factory
 * 
 * Singleton factory para gerenciar instâncias de providers WhatsApp
 */

import type { IWhatsAppProvider } from '../IWhatsAppProvider';
import { BaileysAdapter } from '../adapters/BaileysAdapter';
import { WWebJSAdapter } from '../adapters/WWebJSAdapter';
import { whatsappLogger } from '@/lib/logger';

import { WPPConnectAdapter } from '../adapters/WPPConnectAdapter';
import { execute, queryOne } from '@/lib/db';

export type ProviderType = 'baileys' | 'wwebjs' | 'wppconnect' | 'twilio';

// Extend global type to support singleton persistence in dev mode
declare global {
    var _whatsappFactoryInstance: IWhatsAppProvider | null;
    var _whatsappFactoryType: ProviderType | null;
}

export class WhatsAppProviderFactory {
    // Getters and setters to use global scope
    private static get instance(): IWhatsAppProvider | null {
        return global._whatsappFactoryInstance || null;
    }

    private static set instance(value: IWhatsAppProvider | null) {
        global._whatsappFactoryInstance = value;
    }

    private static get currentType(): ProviderType | null {
        return global._whatsappFactoryType || null;
    }

    private static set currentType(value: ProviderType | null) {
        global._whatsappFactoryType = value;
    }

    /**
     * Get or create provider instance
     * If type is not provided, returns current active provider or defaults to 'baileys'
     */
    static async getProvider(type?: ProviderType): Promise<IWhatsAppProvider> {
        // If query/polling sends specific provider, use it.
        // If session is active (this.currentType), use it.
        // If neither, try to load from database (server restart).
        // Fallback to 'baileys'.

        let requestedType = type || this.currentType;

        if (!requestedType) {
            const persisted = await this.loadPersistedProvider();
            if (persisted) {
                whatsappLogger.info(`[Factory] Loaded persisted provider from DB: ${persisted}`);
                requestedType = persisted;
            }
        }

        requestedType = requestedType || 'baileys';

        // If requesting different provider, reset current instance
        if (this.currentType && this.currentType !== requestedType) {
            whatsappLogger.info(`[Factory] Switching provider from ${this.currentType} to ${requestedType}`);
            await this.reset();
        }

        // Return existing instance if available
        if (this.instance && this.currentType === requestedType) {
            return this.instance;
        }

        // Create new instance
        whatsappLogger.info(`[Factory] Creating new ${requestedType} provider instance`);

        switch (requestedType) {
            case 'baileys':
                this.instance = new BaileysAdapter();
                break;

            case 'wwebjs':
                this.instance = new WWebJSAdapter();
                break;

            case 'wppconnect':
                this.instance = new WPPConnectAdapter();
                break;

            case 'twilio':
                throw new Error('Twilio provider not implemented yet');

            default:
                throw new Error(`Unknown provider type: ${requestedType}`);
        }

        this.currentType = requestedType;
        return this.instance;
    }

    /**
     * Define o tipo de provider a ser usado
     * Útil para trocar provider sem reinicializar
     */
    static async setProvider(type: ProviderType): Promise<IWhatsAppProvider> {
        return this.getProvider(type);
    }

    /**
     * Retorna o tipo de provider atual
     */
    static getCurrentProviderType(): ProviderType | null {
        return this.currentType;
    }

    /**
     * Verifica se há provider inicializado
     */
    static hasProvider(): boolean {
        return this.instance !== null;
    }

    /**
     * Reseta o provider atual (limpa singleton)
     */
    static async reset(): Promise<void> {
        if (this.instance) {
            whatsappLogger.info('Resetting provider instance...');

            try {
                // Tenta fazer logout gracefully
                await this.instance.logout();
            } catch (error) {
                whatsappLogger.warn('Error during provider logout:', error);
            }

            this.instance = null;
            this.currentType = null;
        }
    }

    /**
     * Carrega provider salvo no banco de dados
     */
    private static async loadPersistedProvider(): Promise<ProviderType | null> {
        try {
            const setting = await queryOne<{ value: string }>(
                'SELECT value FROM settings WHERE key = $1',
                ['whatsapp_provider']
            );

            if (setting?.value && ['baileys', 'wwebjs', 'wppconnect'].includes(setting.value)) {
                return setting.value as ProviderType;
            }
            return null;
        } catch (error) {
            whatsappLogger.warn('Failed to load persisted provider from DB:', error);
            return null;
        }
    }

    /**
     * Salva a escolha do provider no banco
     */
    static async persistProvider(type: ProviderType): Promise<void> {
        try {
            await execute(
                `INSERT INTO settings (key, value) 
                 VALUES ('whatsapp_provider', $1) 
                 ON CONFLICT (key) DO UPDATE SET value = $1`,
                [type]
            );
            whatsappLogger.info(`[Factory] Persisted provider preference: ${type}`);
        } catch (error) {
            whatsappLogger.error('Failed to persist provider preference:', error);
        }
    }
}
