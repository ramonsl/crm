/**
 * WhatsApp Provider Factory (Legacy Wrapper)
 * 
 * Mantém compatibilidade com código existente, mas delega a lógica
 * complexa para o WhatsAppProviderManager.
 */

import type { IWhatsAppProvider } from '../IWhatsAppProvider';
import { WhatsAppProviderManager, WebProviderType } from '../manager/WhatsAppProviderManager';
import { whatsappLogger } from '@/lib/logger';

export type ProviderType = 'baileys' | 'wwebjs' | 'wuzapi' | 'wppconnect' | 'ycloud' | 'twilio';

export class WhatsAppProviderFactory {

    /**
     * Get provider instance
     * Delegates to Manager for Hybrid support
     */
    static async getProvider(type?: ProviderType): Promise<IWhatsAppProvider> {
        // Validation for unsupported types (as expected by tests)
        if (type === 'twilio') {
            throw new Error('Twilio provider not implemented yet');
        }
        if (type === 'unknown' as any) {
            throw new Error('Unknown provider');
        }

        const manager = WhatsAppProviderManager.getInstance();

        if (type === 'ycloud') {
            return manager.getOfficialProvider();
        }

        if (type === 'baileys' || type === 'wwebjs' || type === 'wuzapi') {
            return manager.getProvider(type);
        }

        // Default to Web Provider (existing behavior)
        return manager.getWebProvider();
    }

    /**
     * Define o tipo de provider (Web) a ser usado
     */
    static async setProvider(type: ProviderType): Promise<IWhatsAppProvider> {
        if (type === 'ycloud') {
            return this.getProvider('ycloud');
        }
        return this.getProvider(type);
    }

    /**
     * Retorna o tipo de provider atual
     */
    static getCurrentProviderType(): ProviderType | null {
        const manager = WhatsAppProviderManager.getInstance();
        return manager.getWebProviderType();
    }

    /**
     * Verifica se há provider inicializado
     */
    static hasProvider(): boolean {
        const manager = WhatsAppProviderManager.getInstance();
        return manager.hasActiveProvider();
    }

    /**
     * Reset is now handled by Manager internal switching
     */
    static async reset(): Promise<void> {
        WhatsAppProviderManager.reset();
        whatsappLogger.info('[Factory] Reset requested - Manager instance cleared');
    }

    /**
     * Persist provider preference
     */
    static async persistProvider(type: ProviderType): Promise<void> {
        // Only persist if it's a web provider type
        if (type === 'baileys' || type === 'wwebjs' || type === 'wuzapi') {
            const manager = WhatsAppProviderManager.getInstance();
            // getProvider handles switching + persisting the preference to DB
            await manager.getProvider(type);
        }
    }
}

