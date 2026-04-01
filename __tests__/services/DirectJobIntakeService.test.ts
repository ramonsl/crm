/**
 * DirectJobIntakeService unit tests
 */

import { DirectJobIntakeService } from '@/services/DirectJobIntakeService';
import type { WhatsAppMessage } from '@/lib/whatsapp/IWhatsAppProvider';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockJobRepo = {
    exists: jest.fn(),
    create: jest.fn().mockResolvedValue({}),
    updateStatus: jest.fn(),
    getLatest: jest.fn(),
    getByStatus: jest.fn(),
    getStats: jest.fn(),
    getCollectedGroupedByLevel: jest.fn(),
    bulkUpdateStatus: jest.fn(),
};

const mockSettingRepo = {
    get: jest.fn(),
    set: jest.fn(),
    getMultiple: jest.fn(),
    getAll: jest.fn(),
};

jest.mock('@/services/whatsAppGroupService', () => ({
    whatsAppGroupService: {
        sendToGroupById: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('@/services/WhatsAppChatService', () => ({
    whatsAppChatService: {
        sendTextMessage: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('@/services/JobTransformerService', () => ({
    jobTransformerService: {
        transformPost: jest.fn(),
        formatWhatsAppMessage: jest.fn().mockReturnValue('formatted-job-message'),
        rewriteForwardedJobText: jest.fn(),
    },
}));

jest.mock('@/services/HtmlScraperService', () => ({
    htmlScraperService: {
        scrapeUrlText: jest.fn().mockResolvedValue('scraped page content'),
    },
}));

jest.mock('@/lib/logger', () => ({
    whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Prevent neonDb.ts from being loaded (no DATABASE_URL in test env)
jest.mock('@/lib/repositories/LinkedInJobRepository', () => ({
    LinkedInJobRepository: jest.fn(),
}));

jest.mock('@/lib/repositories/SettingRepository', () => ({
    SettingRepository: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const { whatsAppGroupService } = jest.requireMock('@/services/whatsAppGroupService');
const { whatsAppChatService } = jest.requireMock('@/services/WhatsAppChatService');
const { jobTransformerService } = jest.requireMock('@/services/JobTransformerService');

function makeService() {
    return new DirectJobIntakeService(mockJobRepo as never, mockSettingRepo as never);
}

function makeMsg(overrides: Partial<WhatsAppMessage> = {}): WhatsAppMessage {
    return {
        id: 'msg-1',
        from: '5551999999999',
        body: '',
        fromMe: false,
        isGroup: false,
        timestamp: new Date(),
        ...overrides,
    } as WhatsAppMessage;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DirectJobIntakeService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('processDirectJobMessage()', () => {
        it('returns false for messages sent by the bot itself', async () => {
            const service = makeService();
            const result = await service.processDirectJobMessage(makeMsg({ fromMe: true }));
            expect(result).toBe(false);
        });

        it('returns false for group messages', async () => {
            const service = makeService();
            const result = await service.processDirectJobMessage(makeMsg({ isGroup: true }));
            expect(result).toBe(false);
        });

        it('returns false for short messages with no recognizable content', async () => {
            const service = makeService();
            const result = await service.processDirectJobMessage(makeMsg({ body: 'Oi! Tudo bem?' }));
            expect(result).toBe(false);
        });
    });

    describe('Link-based intake', () => {
        it('processes a valid job link and sends to group', async () => {
            mockSettingRepo.get.mockResolvedValue('group-id');
            jobTransformerService.transformPost.mockResolvedValue({
                post_id: 'manual-123',
                title: 'Dev React',
                company: 'TechCorp',
                location: 'Remoto',
                isRemote: true,
                requirements: [],
                applicationLink: 'https://gupy.io/job/123',
                isJob: true,
            });

            const service = makeService();
            const result = await service.processDirectJobMessage(
                makeMsg({ body: 'Olha essa vaga https://gupy.io/job/123' }),
            );

            expect(result).toBe(true);
            expect(mockJobRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'posted', title: 'Dev React' }),
            );
            expect(whatsAppGroupService.sendToGroupById).toHaveBeenCalledWith('group-id', 'formatted-job-message');
            expect(whatsAppChatService.sendTextMessage).toHaveBeenCalledWith(
                '5551999999999',
                expect.stringContaining('sucesso'),
            );
        });

        it('returns false when transformPost says the link is not a job', async () => {
            jobTransformerService.transformPost.mockResolvedValue({ isJob: false });

            const service = makeService();
            const result = await service.processDirectJobMessage(
                makeMsg({ body: 'https://gupy.io/job/123' }),
            );

            expect(result).toBe(false);
            expect(mockJobRepo.create).not.toHaveBeenCalled();
        });

        it('notifies user when group_id is not configured', async () => {
            mockSettingRepo.get.mockResolvedValue(null);
            jobTransformerService.transformPost.mockResolvedValue({
                post_id: 'x',
                title: 'Dev',
                company: 'Corp',
                location: 'Remoto',
                isRemote: true,
                requirements: [],
                applicationLink: 'https://gupy.io/job/1',
                isJob: true,
            });

            const service = makeService();
            await service.processDirectJobMessage(makeMsg({ body: 'https://gupy.io/job/1' }));

            expect(whatsAppGroupService.sendToGroupById).not.toHaveBeenCalled();
            expect(whatsAppChatService.sendTextMessage).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('não está configurado'),
            );
        });
    });

    describe('Text-based (forwarded) intake', () => {
        const longJobText = `Estamos contratando! 
Vaga: Desenvolvedor React Pleno | Empresa: TechCorp | Remoto
Requisitos: React, TypeScript, Node.js
Candidate-se: https://empresa.gupy.io/vagas/123
Salário: R$ 8.000 - 12.000
Currículo pelo link acima.`.repeat(3); // Ensure >150 chars

        it('rewrites forwarded job text and sends to group', async () => {
            mockSettingRepo.get.mockResolvedValue('group-id');
            jobTransformerService.rewriteForwardedJobText.mockResolvedValue({
                isJob: true,
                formattedMessage: '🚀 Formatada!',
                applicationLink: 'https://empresa.gupy.io/vagas/123',
            });

            const service = makeService();
            const result = await service.processDirectJobMessage(makeMsg({ body: longJobText }));

            expect(result).toBe(true);
            expect(jobTransformerService.rewriteForwardedJobText).toHaveBeenCalledWith(longJobText);
            expect(whatsAppGroupService.sendToGroupById).toHaveBeenCalledWith('group-id', '🚀 Formatada!');
        });

        it('notifies user when AI says text is not a job', async () => {
            jobTransformerService.rewriteForwardedJobText.mockResolvedValue({
                isJob: false,
                formattedMessage: null,
                applicationLink: null,
            });

            const service = makeService();
            await service.processDirectJobMessage(makeMsg({ body: longJobText }));

            expect(whatsAppGroupService.sendToGroupById).not.toHaveBeenCalled();
            expect(whatsAppChatService.sendTextMessage).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('não parece descrever uma vaga'),
            );
        });

        it('returns false for short text without job keywords', async () => {
            const service = makeService();
            const result = await service.processDirectJobMessage(
                makeMsg({ body: 'Boa tarde, queria informações sobre o curso.' }),
            );
            expect(result).toBe(false);
            expect(jobTransformerService.rewriteForwardedJobText).not.toHaveBeenCalled();
        });
    });
});
