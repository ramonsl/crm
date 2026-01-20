/**
 * WhatsApp Provider Factory
 * 
 * Singleton factory para gerenciar instâncias de providers WhatsApp
 */

import type { IWhatsAppProvider } from '../IWhatsAppProvider';
import { BaileysAdapter } from '../adapters/BaileysAdapter';
import { WWebJSAdapter } from '../adapters/WWebJSAdapter';
import { whatsappLogger } from '@/lib/logger';

export type ProviderType = 'baileys' | 'wwebjs' | 'twilio';

export class WhatsAppProviderFactory {
    private static instance: IWhatsAppProvider | null = null;
    private static currentType: ProviderType | null = null;

    /**
     * Get or create provider instance
     * If type is not provided, returns current active provider or defaults to 'baileys'
     */
    static async getProvider(type?: ProviderType): Promise<IWhatsAppProvider> {
        // If no type specified, use current type if available, otherwise default to 'baileys'
        const requestedType = type || this.currentType || 'baileys';

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
}
