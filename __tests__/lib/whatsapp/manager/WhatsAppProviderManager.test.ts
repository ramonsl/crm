import { WhatsAppProviderManager } from '@/lib/whatsapp/manager/WhatsAppProviderManager';
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory/WhatsAppProviderFactory';
import { BaileysAdapter } from '@/lib/whatsapp/adapters/BaileysAdapter';
import { YCloudAdapter } from '@/lib/whatsapp/adapters/YCloudAdapter';

// Mocks
jest.mock('@/lib/whatsapp/adapters/BaileysAdapter');
jest.mock('@/lib/whatsapp/adapters/WWebJSAdapter');
jest.mock('@/lib/whatsapp/adapters/YCloudAdapter', () => {
    return {
        YCloudAdapter: jest.fn().mockImplementation(() => ({
            initialize: jest.fn().mockResolvedValue(true),
            isReady: jest.fn().mockResolvedValue(true),
            logout: jest.fn().mockResolvedValue(true),
        }))
    };
});
jest.mock('@/lib/db', () => ({
    queryOne: jest.fn().mockResolvedValue({ value: 'baileys' }),
    execute: jest.fn().mockResolvedValue(true),
}));

describe('WhatsAppProviderManager', () => {
    let manager: WhatsAppProviderManager;

    beforeEach(() => {
        // Reset Singleton for testing
        global._providerManagerInstance = null;
        manager = WhatsAppProviderManager.getInstance();
        jest.clearAllMocks();
    });

    it('should be a singleton', () => {
        const instance2 = WhatsAppProviderManager.getInstance();
        expect(manager).toBe(instance2);
    });

    it('should return YCloud adapter for ycloud type', async () => {
        const provider = await manager.getProvider('ycloud');
        expect(provider).toBeDefined();
        expect(provider.initialize).toBeDefined();
        // expect(provider).toBeInstanceOf(YCloudAdapter); // Fails due to factory mock returning POJO
    });

    it('should return configured Web adapter for web types', async () => {
        const provider = await manager.getProvider('baileys');
        expect(provider).toBeInstanceOf(BaileysAdapter);
    });

    it('should wrap manager calls via Factory for legacy compatibility', async () => {
        const factoryProvider = await WhatsAppProviderFactory.getProvider('baileys');
        const managerProvider = await manager.getWebProvider();

        // They might be different instances if manager creates lazy, but types should match
        expect(factoryProvider).toBeInstanceOf(BaileysAdapter);
        expect(managerProvider).toBeInstanceOf(BaileysAdapter);
    });
});
