/**
 * JobOrchestrationService unit tests
 *
 * All external dependencies are mocked so no real network or DB calls are made.
 */

import { JobOrchestrationService } from '@/services/JobOrchestrationService';
import { SyncStateManager } from '@/services/SyncStateManager';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSettingRepo = {
    get: jest.fn(),
    set: jest.fn(),
    getMultiple: jest.fn(),
    getAll: jest.fn(),
};

const mockJobRepo = {
    exists: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    getLatest: jest.fn(),
    getByStatus: jest.fn(),
    getStats: jest.fn(),
    getCollectedGroupedByLevel: jest.fn(),
    bulkUpdateStatus: jest.fn(),
};

jest.mock('@/services/whatsAppGroupService', () => ({
    whatsAppGroupService: {
        sendToGroupById: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('@/services/LinkedInScraperService', () => ({
    linkedInScraperService: {
        fetchProfilePosts: jest.fn().mockResolvedValue([]),
        filterRecentPosts: jest.fn().mockReturnValue([]),
    },
}));

jest.mock('@/services/RemotarScraperService', () => ({
    remotarScraperService: {
        fetchRecentJobs: jest.fn().mockResolvedValue([]),
        filterRecentJobs: jest.fn().mockReturnValue([]),
    },
}));

jest.mock('@/services/VagasRemotasScraperService', () => ({
    vagasRemotasScraperService: {
        fetchJobs: jest.fn().mockResolvedValue([]),
        filterRecentJobs: jest.fn().mockReturnValue([]),
    },
}));

jest.mock('@/services/scrapers/WorkeiScraperService', () => ({
    workeiScraperService: {
        fetchRecentJobs: jest.fn().mockResolvedValue([]),
        filterRecentJobs: jest.fn().mockReturnValue([]),
    },
}));

jest.mock('@/services/JobGroupMessageFormatter', () => ({
    formatGroupByLevel: jest.fn().mockReturnValue('formatted-group-message'),
    formatDailySummary: jest.fn().mockReturnValue('daily-summary'),
}));

jest.mock('@/lib/logger', () => ({
    dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const { whatsAppGroupService } = jest.requireMock('@/services/whatsAppGroupService');

function makeEmptyGrouped() {
    return { estagio: [], junior: [], pleno: [], senior: [], outros: [] };
}

function makeService() {
    return new JobOrchestrationService(
        mockJobRepo as never,
        mockSettingRepo as never,
        new SyncStateManager(),
    );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('JobOrchestrationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('runSync()', () => {
        it('returns early with empty stats when group_id is not configured', async () => {
            mockSettingRepo.get.mockResolvedValue(null);
            const service = makeService();

            const result = await service.runSync();

            expect(result.posted).toBe(0);
            expect(result.errors).toBe(0);
        });

        it('throws and finishes state when sync crashes', async () => {
            mockSettingRepo.get.mockResolvedValue('group-id');
            mockJobRepo.getCollectedGroupedByLevel.mockRejectedValue(new Error('db failure'));
            const service = makeService();

            await expect(service.runSync()).rejects.toThrow('db failure');
            expect(service.isSyncing).toBe(false);
        });

        it('prevents concurrent runs', async () => {
            mockSettingRepo.get.mockResolvedValue(null);
            const service = makeService();

            // Force the state into a syncing state manually
            service.state.start();

            await expect(service.runSync()).rejects.toThrow('Uma sincronização já está em andamento.');
        });

        it('sends a grouped message per seniority level that has jobs', async () => {
            mockSettingRepo.get.mockResolvedValue('group-id');
            mockJobRepo.getCollectedGroupedByLevel.mockResolvedValue({
                estagio: [],
                junior: [{ id: 1, title: 'Dev Jr', company: 'Corp', location: 'Remoto', url: 'https://x.com', raw_content: 'desc' }],
                pleno: [],
                senior: [],
                outros: [],
            });
            mockJobRepo.bulkUpdateStatus.mockResolvedValue(undefined);

            const service = makeService();
            const result = await service.runSync();

            expect(whatsAppGroupService.sendToGroupById).toHaveBeenCalledWith(
                'group-id',
                'formatted-group-message',
                expect.objectContaining({ idempotencyKey: expect.stringContaining('junior') }),
            );
            expect(result.posted).toBe(1);
        });

        it('increments stats.errors when sending a level fails', async () => {
            mockSettingRepo.get.mockResolvedValue('group-id');
            mockJobRepo.getCollectedGroupedByLevel.mockResolvedValue({
                ...makeEmptyGrouped(),
                junior: [{ id: 1, title: 'Dev', company: 'Corp', location: 'Remoto', url: 'https://x', raw_content: '' }],
            });
            mockJobRepo.bulkUpdateStatus.mockResolvedValue(undefined);
            whatsAppGroupService.sendToGroupById.mockRejectedValueOnce(new Error('WA timeout'));

            const service = makeService();
            const result = await service.runSync();

            expect(result.errors).toBe(1);
            expect(result.posted).toBe(0);
        });

        it('sends a notifyGroupId "searching" message before starting', async () => {
            mockSettingRepo.get.mockResolvedValue('group-id');
            mockJobRepo.getCollectedGroupedByLevel.mockResolvedValue(makeEmptyGrouped());

            const service = makeService();
            await service.runSync('notify-group-id');

            expect(whatsAppGroupService.sendToGroupById).toHaveBeenCalledWith(
                'notify-group-id',
                expect.stringContaining('Buscando'),
            );
        });
    });

    describe('resendErrors()', () => {
        it('returns early when no error jobs exist', async () => {
            mockSettingRepo.get.mockResolvedValue('group-id');
            mockJobRepo.getByStatus.mockResolvedValue([]);

            const service = makeService();
            const result = await service.resendErrors();

            expect(result.processed).toBe(0);
            expect(mockJobRepo.bulkUpdateStatus).not.toHaveBeenCalled();
        });

        it('marks error jobs as collected and sends through the grouped pipeline', async () => {
            mockSettingRepo.get.mockResolvedValue('group-id');
            mockJobRepo.getByStatus.mockResolvedValue([{ id: 10 }, { id: 11 }]);
            mockJobRepo.bulkUpdateStatus.mockResolvedValue(undefined);
            mockJobRepo.getCollectedGroupedByLevel.mockResolvedValue(makeEmptyGrouped());

            const service = makeService();
            const result = await service.resendErrors();

            expect(result.processed).toBe(2);
            expect(mockJobRepo.bulkUpdateStatus).toHaveBeenCalledWith([10, 11], 'collected', undefined);
        });

        it('prevents concurrent runs', async () => {
            mockSettingRepo.get.mockResolvedValue(null);
            const service = makeService();
            service.state.start();

            await expect(service.resendErrors()).rejects.toThrow('Uma operação de sincronização já está em andamento.');
        });
    });
});
