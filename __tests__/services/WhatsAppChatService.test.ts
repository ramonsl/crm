import { whatsAppChatService, WhatsAppChatService } from '@/services/WhatsAppChatService';
import { WhatsAppProviderManager } from '@/lib/whatsapp/manager/WhatsAppProviderManager';
import { WhatsAppRepository } from '@/lib/repositories';

// Mock dependencies
jest.mock('@/lib/whatsapp/manager/WhatsAppProviderManager');
jest.mock('@/lib/repositories');
jest.mock('@/lib/logger', () => ({
    chatLogger: { debug: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
    dbLogger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
    whatsappLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    socketLogger: { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    yCloudLogger: { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    authLogger: { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    syncLogger: { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    autoReplyLogger: { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock('@/lib/neonDb', () => ({
    pool: { query: jest.fn() }
}));

describe('WhatsAppChatService', () => {
    let service: WhatsAppChatService;
    let mockProviderManager: any;
    let mockProvider: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockProvider = {
            sendTextMessage: jest.fn().mockResolvedValue(true),
            isOfficialReady: jest.fn().mockResolvedValue(true),
            isWebReady: jest.fn().mockResolvedValue(true)
        };

        mockProviderManager = {
            getProvider: jest.fn().mockResolvedValue(mockProvider),
            isOfficialReady: jest.fn().mockResolvedValue(true),
            isWebReady: jest.fn().mockResolvedValue(true)
        };

        (WhatsAppProviderManager.getInstance as jest.Mock).mockReturnValue(mockProviderManager);

        // Re-instantiate service to inject mock manager
        service = new WhatsAppChatService();
    });

    it('should route message to selected provider', async () => {
        const phone = '5511999999999';
        const message = 'Hello';
        const options = { provider: 'ycloud' as const };

        await service.sendTextMessage(phone, message, options);

        expect(mockProviderManager.getProvider).toHaveBeenCalledWith('ycloud');
        expect(mockProvider.sendTextMessage).toHaveBeenCalledWith(phone, message);
    });

    it('should default to baileys if no provider specified', async () => {
        const phone = '5511999999999';
        const message = 'Hello';

        await service.sendTextMessage(phone, message);

        expect(mockProviderManager.getProvider).toHaveBeenCalledWith('baileys');
        expect(mockProvider.sendTextMessage).toHaveBeenCalledWith(phone, message);
    });

    it('should check official readiness', async () => {
        await service.isReady('ycloud');
        expect(mockProviderManager.isOfficialReady).toHaveBeenCalled();
    });

    it('should check web readiness by default', async () => {
        await service.isReady();
        expect(mockProviderManager.isWebReady).toHaveBeenCalled();
    });
});
