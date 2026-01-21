/**
 * Auto-Reply Service Tests
 * Tests for business logic of auto-reply system
 */

import { AutoReplyService } from '@/services/autoReplyService';
import * as autoReplyRepo from '@/lib/repositories/AutoReplyRepository';
import * as intentService from '@/services/intentDetectionService';
import type { AutoReplyLog } from '@/types/autoReply';

// Mock dependencies
jest.mock('@/lib/repositories/AutoReplyRepository');
jest.mock('@/services/intentDetectionService');

const mockRepo = autoReplyRepo.autoReplyRepository as jest.Mocked<typeof autoReplyRepo.autoReplyRepository>;
const mockIntentService = intentService.intentDetectionService as jest.Mocked<typeof intentService.intentDetectionService>;

describe('AutoReplyService', () => {
    let service: AutoReplyService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new AutoReplyService();
    });

    describe('processIncomingMessage', () => {
        it('should return null if auto-reply is globally disabled', async () => {
            service.setEnabled(false);

            const result = await service.processIncomingMessage('5511999999999', 'Olá');

            expect(result).toBeNull();
            expect(mockRepo.findActive).not.toHaveBeenCalled();
        });

        it('should return null if phone is blacklisted', async () => {
            const phone = '5511999999999';
            service.addToBlacklist(phone);

            const result = await service.processIncomingMessage(phone, 'Olá');

            expect(result).toBeNull();
            expect(mockRepo.findActive).not.toHaveBeenCalled();
        });

        it('should return null if phone received auto-reply recently (rate limiting)', async () => {
            const phone = '5511999999999';
            mockRepo.hasRecentAutoReply.mockResolvedValue(true);

            const result = await service.processIncomingMessage(phone, 'Olá');

            expect(result).toBeNull();
            expect(mockRepo.hasRecentAutoReply).toHaveBeenCalledWith(phone, 5);
        });

        it('should return null if no active auto-replies configured', async () => {
            mockRepo.hasRecentAutoReply.mockResolvedValue(false);
            mockRepo.findActive.mockResolvedValue([]);

            const result = await service.processIncomingMessage('5511999999999', 'Olá');

            expect(result).toBeNull();
        });

        it('should return null if no intent detected', async () => {
            const mockActiveReplies = [
                {
                    id: 1,
                    name: 'Saudação',
                    intent_description: 'Cumprimento',
                    example_messages: ['Olá'],
                    response_template: 'Olá!',
                    is_active: true,
                    priority: 0,
                    confidence_threshold: 0.7,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            ];

            mockRepo.hasRecentAutoReply.mockResolvedValue(false);
            mockRepo.findActive.mockResolvedValue(mockActiveReplies);
            mockIntentService.detectIntent.mockResolvedValue(null);

            const result = await service.processIncomingMessage('5511999999999', 'xyz');

            expect(result).toBeNull();
        });

        it('should return null if confidence is below threshold', async () => {
            const mockActiveReplies = [
                {
                    id: 1,
                    name: 'Saudação',
                    intent_description: 'Cumprimento',
                    example_messages: ['Olá'],
                    response_template: 'Olá!',
                    is_active: true,
                    priority: 0,
                    confidence_threshold: 0.9,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            ];

            const mockDetection = {
                intent: 'Saudação',
                confidence: 0.5,
                autoReplyId: 1,
            };

            mockRepo.hasRecentAutoReply.mockResolvedValue(false);
            mockRepo.findActive.mockResolvedValue(mockActiveReplies);
            mockIntentService.detectIntent.mockResolvedValue(mockDetection);

            const result = await service.processIncomingMessage('5511999999999', 'Olá');

            expect(result).toBeNull();
        });

        it('should return rendered response if all conditions met', async () => {
            const phone = '5511999999999';
            const message = 'Olá, tudo bem?';

            const mockActiveReplies = [
                {
                    id: 1,
                    name: 'Saudação',
                    intent_description: 'Cumprimento',
                    example_messages: ['Olá'],
                    response_template: 'Olá {{name}}! Como posso ajudar?',
                    is_active: true,
                    priority: 0,
                    confidence_threshold: 0.7,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            ];

            const mockDetection = {
                intent: 'Saudação',
                confidence: 0.95,
                autoReplyId: 1,
            };

            mockRepo.hasRecentAutoReply.mockResolvedValue(false);
            mockRepo.findActive.mockResolvedValue(mockActiveReplies);
            mockIntentService.detectIntent.mockResolvedValue(mockDetection);
            mockRepo.createLog.mockResolvedValue({} as unknown as AutoReplyLog);

            const result = await service.processIncomingMessage(phone, message);

            expect(result).toBeTruthy();
            expect(result).toContain('Olá');
            expect(result).toContain('Como posso ajudar?');
            expect(mockRepo.createLog).toHaveBeenCalled();
        });
    });

    describe('renderTemplate', () => {
        it('should replace {{name}} variable', () => {
            const result = service.renderTemplate('Olá {{name}}!', {
                phone: '5511999999999',
                message: 'test',
                name: 'João'
            });

            expect(result).toBe('Olá João!');
        });

        it('should replace {{phone}} variable', () => {
            const result = service.renderTemplate('Seu telefone: {{phone}}', {
                phone: '5511999999999',
                message: 'test'
            });

            expect(result).toBe('Seu telefone: 5511999999999');
        });

        it('should replace {{date}} variable with current date', () => {
            const result = service.renderTemplate('Hoje é {{date}}', {
                phone: '5511999999999',
                message: 'test'
            });

            expect(result).toContain('/');
        });

        it('should replace {{time}} variable with current time', () => {
            const result = service.renderTemplate('São {{time}}', {
                phone: '5511999999999',
                message: 'test'
            });

            expect(result).toMatch(/\d{2}:\d{2}/);
        });

        it('should replace multiple variables', () => {
            const result = service.renderTemplate('Olá {{name}}! Seu telefone: {{phone}}', {
                phone: '5511999999999',
                message: 'test',
                name: 'Maria'
            });

            expect(result).toBe('Olá Maria! Seu telefone: 5511999999999');
        });

        it('should use "Cliente" as default name if not provided', () => {
            const result = service.renderTemplate('Olá {{name}}!', {
                phone: '5511999999999',
                message: 'test'
            });

            expect(result).toBe('Olá Cliente!');
        });
    });

    describe('Configuration', () => {
        it('should enable/disable auto-reply globally', () => {
            expect(service.isAutoReplyEnabled()).toBe(true);

            service.setEnabled(false);
            expect(service.isAutoReplyEnabled()).toBe(false);

            service.setEnabled(true);
            expect(service.isAutoReplyEnabled()).toBe(true);
        });

        it('should manage blacklist', () => {
            const phone = '5511999999999';

            expect(service.isBlacklisted(phone)).toBe(false);

            service.addToBlacklist(phone);
            expect(service.isBlacklisted(phone)).toBe(true);

            service.removeFromBlacklist(phone);
            expect(service.isBlacklisted(phone)).toBe(false);
        });

        it('should set rate limit duration', () => {
            service.setRateLimitMinutes(10);
            const config = service.getConfig();
            expect(config.rateLimitMinutes).toBe(10);
        });

        it('should return current configuration', () => {
            service.setEnabled(true);
            service.addToBlacklist('5511111111111');
            service.addToBlacklist('5522222222222');
            service.setRateLimitMinutes(15);

            const config = service.getConfig();

            expect(config.isEnabled).toBe(true);
            expect(config.blacklistedCount).toBe(2);
            expect(config.rateLimitMinutes).toBe(15);
        });
    });
});
