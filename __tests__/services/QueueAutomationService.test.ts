/**
 * QueueAutomationService Tests
 * Tests for the queue idle automation feature
 */

import { QueueAutomationService } from '@/services/QueueAutomationService';
import type { QueueAutomationConfig } from '@/types/queueAutomation';

// Mock dependencies
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn()
    }
}));

jest.mock('@/lib/messageQueue', () => ({
    messageQueue: {
        enqueue: jest.fn(),
        getState: jest.fn().mockReturnValue({ queueLength: 0, processing: false, logs: [], stats: { total: 0, processed: 0, failed: 0 } })
    }
}));

// Mock repository
const mockRepository = {
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
    logSend: jest.fn(),
    hasBeenContacted: jest.fn(),
    getLogStats: jest.fn()
};

// Mock lead repository
const mockLeadRepo = {
    findByCpf: jest.fn()
};

// Mock template repository
const mockTemplateRepo = {
    findById: jest.fn()
};

describe('QueueAutomationService', () => {
    let service: QueueAutomationService;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create service with mocked dependencies
        service = new QueueAutomationService(
            mockRepository as any,
            mockLeadRepo as any,
            mockTemplateRepo as any
        );
    });

    describe('getCurrentHourBrazil', () => {
        it('should return hour adjusted for Brazil timezone (UTC-3)', () => {
            const hour = service.getCurrentHourBrazil();

            // Hour should be between 0 and 23
            expect(hour).toBeGreaterThanOrEqual(0);
            expect(hour).toBeLessThan(24);
        });
    });

    describe('isWithinOperatingHours', () => {
        const baseConfig: QueueAutomationConfig = {
            id: 1,
            templateId: 1,
            targetStatus: null,
            messageType: 'fixed',
            isActive: true,
            startHour: 8,
            endHour: 21,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        it('should return true when current hour is within range', () => {
            // Mock getCurrentHourBrazil to return 14 (2pm)
            jest.spyOn(service, 'getCurrentHourBrazil').mockReturnValue(14);

            const result = service.isWithinOperatingHours(baseConfig);

            expect(result).toBe(true);
        });

        it('should return false when current hour is before start', () => {
            jest.spyOn(service, 'getCurrentHourBrazil').mockReturnValue(7);

            const result = service.isWithinOperatingHours(baseConfig);

            expect(result).toBe(false);
        });

        it('should return false when current hour is at or after end', () => {
            jest.spyOn(service, 'getCurrentHourBrazil').mockReturnValue(21);

            const result = service.isWithinOperatingHours(baseConfig);

            expect(result).toBe(false);
        });

        it('should return true when hour equals start hour', () => {
            jest.spyOn(service, 'getCurrentHourBrazil').mockReturnValue(8);

            const result = service.isWithinOperatingHours(baseConfig);

            expect(result).toBe(true);
        });
    });

    describe('onQueueEmpty', () => {
        const mockConfig: QueueAutomationConfig = {
            id: 1,
            templateId: 1,
            targetStatus: null,
            messageType: 'fixed',
            isActive: true,
            startHour: 8,
            endHour: 21,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const mockTemplate = {
            id: 1,
            name: 'Test Template',
            message: 'Hello {nome}!',
            type: 'fixed'
        };

        const mockLead = {
            cpf: '12345678900',
            nome: 'João Silva',
            telefone: '5511999999999'
        };

        it('should not send if config not found', async () => {
            mockRepository.getConfig.mockResolvedValue(null);

            const result = await service.onQueueEmpty();

            expect(result.sent).toBe(false);
            expect(result.reason).toContain('Configuração não encontrada');
        });

        it('should not send if automation is disabled', async () => {
            mockRepository.getConfig.mockResolvedValue({
                ...mockConfig,
                isActive: false
            });

            const result = await service.onQueueEmpty();

            expect(result.sent).toBe(false);
            expect(result.reason).toContain('desativada');
        });

        it('should not send if outside operating hours', async () => {
            mockRepository.getConfig.mockResolvedValue(mockConfig);
            jest.spyOn(service, 'isWithinOperatingHours').mockReturnValue(false);
            jest.spyOn(service, 'getCurrentHourBrazil').mockReturnValue(23);

            const result = await service.onQueueEmpty();

            expect(result.sent).toBe(false);
            expect(result.reason).toContain('Fora do horário');
        });

        it('should not send if no template configured', async () => {
            mockRepository.getConfig.mockResolvedValue({
                ...mockConfig,
                templateId: null
            });
            jest.spyOn(service, 'isWithinOperatingHours').mockReturnValue(true);

            const result = await service.onQueueEmpty();

            expect(result.sent).toBe(false);
            expect(result.reason).toContain('template configurado');
        });

        it('should not send if template not found', async () => {
            mockRepository.getConfig.mockResolvedValue(mockConfig);
            jest.spyOn(service, 'isWithinOperatingHours').mockReturnValue(true);
            mockTemplateRepo.findById.mockResolvedValue(null);

            const result = await service.onQueueEmpty();

            expect(result.sent).toBe(false);
            expect(result.reason).toContain('Template não encontrado');
        });

        it('should not send if no eligible lead available', async () => {
            mockRepository.getConfig.mockResolvedValue(mockConfig);
            jest.spyOn(service, 'isWithinOperatingHours').mockReturnValue(true);
            mockTemplateRepo.findById.mockResolvedValue(mockTemplate);

            // Mock getNextEligibleLead to return null
            jest.spyOn(service, 'getNextEligibleLead').mockResolvedValue(null);

            const result = await service.onQueueEmpty();

            expect(result.sent).toBe(false);
            expect(result.reason).toContain('lead elegível');
        });

        it('should send message when all conditions are met', async () => {
            const { messageQueue } = require('@/lib/messageQueue');

            mockRepository.getConfig.mockResolvedValue(mockConfig);
            jest.spyOn(service, 'isWithinOperatingHours').mockReturnValue(true);
            mockTemplateRepo.findById.mockResolvedValue(mockTemplate);
            jest.spyOn(service, 'getNextEligibleLead').mockResolvedValue(mockLead);
            mockRepository.logSend.mockResolvedValue(undefined);

            const result = await service.onQueueEmpty();

            expect(result.sent).toBe(true);
            expect(result.reason).toContain('sucesso');
            expect(messageQueue.enqueue).toHaveBeenCalledWith([
                expect.objectContaining({
                    phone: mockLead.telefone,
                    name: mockLead.nome,
                    cpf: mockLead.cpf,
                    templateId: mockTemplate.id
                })
            ]);
            expect(mockRepository.logSend).toHaveBeenCalledWith(
                mockLead.cpf,
                mockConfig.templateId,
                true
            );
        });

        it('should set isAi flag when messageType is ai', async () => {
            const { messageQueue } = require('@/lib/messageQueue');

            mockRepository.getConfig.mockResolvedValue({
                ...mockConfig,
                messageType: 'ai'
            });
            jest.spyOn(service, 'isWithinOperatingHours').mockReturnValue(true);
            mockTemplateRepo.findById.mockResolvedValue(mockTemplate);
            jest.spyOn(service, 'getNextEligibleLead').mockResolvedValue(mockLead);
            mockRepository.logSend.mockResolvedValue(undefined);

            await service.onQueueEmpty();

            expect(messageQueue.enqueue).toHaveBeenCalledWith([
                expect.objectContaining({
                    isAi: true
                })
            ]);
        });
    });

    describe('getStatus', () => {
        it('should return complete status information', async () => {
            const mockConfig: QueueAutomationConfig = {
                id: 1,
                templateId: 1,
                targetStatus: null,
                messageType: 'fixed',
                isActive: true,
                startHour: 8,
                endHour: 21,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockRepository.getConfig.mockResolvedValue(mockConfig);
            mockRepository.getLogStats.mockResolvedValue({
                totalSent: 10,
                lastSentAt: new Date('2024-01-01T12:00:00')
            });
            jest.spyOn(service, 'getCurrentHourBrazil').mockReturnValue(14);

            const status = await service.getStatus();

            expect(status.isActive).toBe(true);
            expect(status.isWithinOperatingHours).toBe(true);
            expect(status.currentHourBrazil).toBe(14);
            expect(status.totalSent).toBe(10);
            expect(status.lastSentAt).toEqual(new Date('2024-01-01T12:00:00'));
        });

        it('should handle null config gracefully', async () => {
            mockRepository.getConfig.mockResolvedValue(null);
            mockRepository.getLogStats.mockResolvedValue({
                totalSent: 0,
                lastSentAt: null
            });

            const status = await service.getStatus();

            expect(status.isActive).toBe(false);
            expect(status.isWithinOperatingHours).toBe(false);
        });
    });

    describe('updateConfig', () => {
        it('should call repository updateConfig', async () => {
            mockRepository.updateConfig.mockResolvedValue(undefined);

            await service.updateConfig({
                templateId: 2,
                isActive: true
            });

            expect(mockRepository.updateConfig).toHaveBeenCalledWith({
                templateId: 2,
                isActive: true
            });
        });
    });
});
