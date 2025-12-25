/**
 * Provider Factory
 * 
 * Factory for obtaining the correct message provider based on configuration.
 * Following Factory Pattern: Encapsulates provider instantiation.
 */

import type { IMessageProvider, ProviderType } from './IMessageProvider';
import { WhatsAppJSProvider } from './WhatsAppJSProvider';
import { YCloudProvider } from './YCloudProvider';

// Singleton instances
let whatsappJSProvider: WhatsAppJSProvider | null = null;
let yCloudProvider: YCloudProvider | null = null;

/**
 * Get a specific provider by type
 */
export function getProvider(type: ProviderType): IMessageProvider {
    switch (type) {
        case 'ycloud':
            if (!yCloudProvider) {
                yCloudProvider = new YCloudProvider();
            }
            return yCloudProvider;

        case 'whatsappjs':
        default:
            if (!whatsappJSProvider) {
                whatsappJSProvider = new WhatsAppJSProvider();
            }
            return whatsappJSProvider;
    }
}

/**
 * Get the currently active provider based on settings
 */
export async function getActiveProvider(): Promise<IMessageProvider> {
    try {
        const { SettingRepository } = await import('../repositories/SettingRepository');
        const settingRepo = new SettingRepository();

        const providerSetting = await settingRepo.get('bulk_send_provider');
        const providerType = (providerSetting as ProviderType) || 'whatsappjs';

        return getProvider(providerType);
    } catch {
        // Default to WhatsAppJS if settings fail
        return getProvider('whatsappjs');
    }
}

/**
 * Get the active provider type from settings
 */
export async function getActiveProviderType(): Promise<ProviderType> {
    try {
        const { SettingRepository } = await import('../repositories/SettingRepository');
        const settingRepo = new SettingRepository();

        const providerSetting = await settingRepo.get('bulk_send_provider');
        return (providerSetting as ProviderType) || 'whatsappjs';
    } catch {
        return 'whatsappjs';
    }
}
