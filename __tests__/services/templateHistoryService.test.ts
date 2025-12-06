/**
 * TemplateHistoryService Tests
 * Unit tests for template history service layer
 */

import { TemplateHistoryService, TemplateSentEvent } from '@/services/templateHistoryService';
import type { ITemplateHistoryRepository, TemplateHistoryEntry } from '@/repositories/templateHistoryRepository';

describe('TemplateHistoryService', () => {
    let mockRepository: jest.Mocked<ITemplateHistoryRepository>;
    let service: TemplateHistoryService;

    beforeEach(() => {
        // Create mock repository
        mockRepository = {
            saveHistory: jest.fn(),
            findByPhone: jest.fn(),
            updateLastTemplate: jest.fn(),
            getLastTemplateSent: jest.fn()
        };

        // Create service with mocked repository
        service = new TemplateHistoryService(mockRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('recordTemplateSent', () => {
        it('should save history and update last template on success', async () => {
            const event: TemplateSentEvent = {
                phone: '51999887766',
                templateName: 'Boas-vindas',
                templateContent: 'Olá, bem-vindo!',
                success: true
            };

            await service.recordTemplateSent(event);

            // Should save history
            expect(mockRepository.saveHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    phone: '51999887766',
                    template_name: 'Boas-vindas',
                    template_content: 'Olá, bem-vindo!',
                    success: true
                })
            );

            // Should update last template
            expect(mockRepository.updateLastTemplate).toHaveBeenCalledWith(
                '51999887766',
                'Boas-vindas'
            );
        });

        it('should save history but NOT update last template on failure', async () => {
            const event: TemplateSentEvent = {
                phone: '51999887766',
                templateName: 'Test',
                templateContent: 'Content',
                success: false,
                errorMessage: 'WhatsApp not ready'
            };

            await service.recordTemplateSent(event);

            // Should save history with error
            expect(mockRepository.saveHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    phone: '51999887766',
                    template_name: 'Test',
                    success: false,
                    error_message: 'WhatsApp not ready'
                })
            );

            // Should NOT update last template
            expect(mockRepository.updateLastTemplate).not.toHaveBeenCalled();
        });

        it('should include timestamp in saveHistory call', async () => {
            const event: TemplateSentEvent = {
                phone: '51999887766',
                templateName: 'Test',
                templateContent: 'Content',
                success: true
            };

            await service.recordTemplateSent(event);

            expect(mockRepository.saveHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    sent_at: expect.any(String)
                })
            );

            // Verify timestamp is ISO format
            const call = mockRepository.saveHistory.mock.calls[0][0];
            expect(new Date(call.sent_at).toISOString()).toBe(call.sent_at);
        });

        it('should handle repository errors', async () => {
            const event: TemplateSentEvent = {
                phone: '51999887766',
                templateName: 'Test',
                templateContent: 'Content',
                success: true
            };

            mockRepository.saveHistory.mockRejectedValue(new Error('Database error'));

            await expect(service.recordTemplateSent(event)).rejects.toThrow('Database error');
        });

        it('should handle updateLastTemplate errors gracefully', async () => {
            const event: TemplateSentEvent = {
                phone: '51999887766',
                templateName: 'Test',
                templateContent: 'Content',
                success: true
            };

            // saveHistory succeeds, but updateLastTemplate fails
            mockRepository.saveHistory.mockResolvedValue();
            mockRepository.updateLastTemplate.mockRejectedValue(new Error('Update failed'));

            // Should propagate the error
            await expect(service.recordTemplateSent(event)).rejects.toThrow('Update failed');
        });
    });

    describe('getPhoneHistory', () => {
        it('should return history for a phone number', async () => {
            const mockHistory: TemplateHistoryEntry[] = [
                {
                    id: 1,
                    phone: '51999887766',
                    template_name: 'Boas-vindas',
                    template_content: 'Olá',
                    sent_at: '2025-12-06T10:00:00Z',
                    success: true,
                    error_message: null
                },
                {
                    id: 2,
                    phone: '51999887766',
                    template_name: 'Follow-up',
                    template_content: 'Como vai?',
                    sent_at: '2025-12-06T11:00:00Z',
                    success: true,
                    error_message: null
                }
            ];

            mockRepository.findByPhone.mockResolvedValue(mockHistory);

            const history = await service.getPhoneHistory('51999887766');

            expect(history).toEqual(mockHistory);
            expect(mockRepository.findByPhone).toHaveBeenCalledWith('51999887766', 50);
        });

        it('should accept custom limit', async () => {
            mockRepository.findByPhone.mockResolvedValue([]);

            await service.getPhoneHistory('51999887766', 100);

            expect(mockRepository.findByPhone).toHaveBeenCalledWith('51999887766', 100);
        });

        it('should return empty array if no history', async () => {
            mockRepository.findByPhone.mockResolvedValue([]);

            const history = await service.getPhoneHistory('51999887766');

            expect(history).toEqual([]);
        });

        it('should handle repository errors', async () => {
            mockRepository.findByPhone.mockRejectedValue(new Error('Query failed'));

            await expect(service.getPhoneHistory('51999887766')).rejects.toThrow('Query failed');
        });
    });

    describe('getLastTemplateSent', () => {
        it('should return last template name', async () => {
            mockRepository.getLastTemplateSent.mockResolvedValue('Boas-vindas');

            const templateName = await service.getLastTemplateSent('51999887766');

            expect(templateName).toBe('Boas-vindas');
            expect(mockRepository.getLastTemplateSent).toHaveBeenCalledWith('51999887766');
        });

        it('should return null if no template sent', async () => {
            mockRepository.getLastTemplateSent.mockResolvedValue(null);

            const templateName = await service.getLastTemplateSent('51999887766');

            expect(templateName).toBeNull();
        });

        it('should return null on repository error', async () => {
            mockRepository.getLastTemplateSent.mockRejectedValue(new Error('Database error'));

            const templateName = await service.getLastTemplateSent('51999887766');

            expect(templateName).toBeNull();
        });
    });

    describe('Dependency Injection', () => {
        it('should work with different repository implementations', async () => {
            // Create a different mock repository
            const alternativeRepo: jest.Mocked<ITemplateHistoryRepository> = {
                saveHistory: jest.fn(),
                findByPhone: jest.fn().mockResolvedValue([]),
                updateLastTemplate: jest.fn(),
                getLastTemplateSent: jest.fn()
            };

            const alternativeService = new TemplateHistoryService(alternativeRepo);

            await alternativeService.getPhoneHistory('51999887766');

            expect(alternativeRepo.findByPhone).toHaveBeenCalled();
            expect(mockRepository.findByPhone).not.toHaveBeenCalled();
        });
    });
});
