/**
 * WhatsApp Provider Factory
 * 
 * Factory pattern para criar e gerenciar instâncias de providers WhatsApp.
 * Implementa singleton pattern para garantir única instância por provider.
 */

import type { IWhatsAppProvider } from '../IWhatsAppProvider';
import { BaileysAdapter } from '../adapters/BaileysAdapter';
import { whatsappLogger } from '@/lib/logger';

export type ProviderType = 'baileys' | 'wwebjs' | 'twilio';

export class WhatsAppProviderFactory {
    private static instance: IWhatsAppProvider | null = null;
    private static currentProviderType: ProviderType | null = null;

    /**
     * Obtém instância do provider (singleton)
     * @param type Tipo de provider (default: baileys)
     * @returns Instância do provider
     */
    static async getProvider(type: ProviderType = 'baileys'): Promise<IWhatsAppProvider> {
        // Se já existe instância do mesmo tipo, retorna
        if (this.instance && this.currentProviderType === type) {
            return this.instance;
        }

        // Se existe instância de outro tipo, limpa antes
        if (this.instance && this.currentProviderType !== type) {
            whatsappLogger.info(`Switching provider from ${this.currentProviderType} to ${type}`);
            await this.reset();
        }

        // Cria nova instância
        whatsappLogger.info(`Creating ${type} provider instance...`);

        switch (type) {
            case 'baileys':
                this.instance = new BaileysAdapter();
                break;

            case 'wwebjs':
                // TODO: Implementar WWebJSAdapter
                throw new Error('WWebJS adapter not implemented yet');

            case 'twilio':
                // TODO: Implementar TwilioAdapter
                throw new Error('Twilio adapter not implemented yet');

            default:
                throw new Error(`Unknown provider type: ${type}`);
        }

        this.currentProviderType = type;
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
        return this.currentProviderType;
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
            this.currentProviderType = null;
        }
    }
}
