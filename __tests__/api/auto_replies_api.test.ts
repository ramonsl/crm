/**
 * Auto-Reply API Tests
 * Tests for CRUD operations on auto-replies
 */

import { GET, POST } from '@/app/api/auto-replies/route';
import { GET as getById, PUT, DELETE } from '@/app/api/auto-replies/[id]/route';
import { POST as toggle } from '@/app/api/auto-replies/[id]/toggle/route';
import { POST as test } from '@/app/api/auto-replies/test/route';
import { GET as getStats } from '@/app/api/auto-replies/stats/route';
import { NextRequest } from 'next/server';
import * as autoReplyRepo from '@/lib/repositories/AutoReplyRepository';
import * as intentService from '@/services/intentDetectionService';

// Mock dependencies
jest.mock('@/lib/repositories/AutoReplyRepository');
jest.mock('@/services/intentDetectionService');

const mockRepo = autoReplyRepo.autoReplyRepository as jest.Mocked<typeof autoReplyRepo.autoReplyRepository>;
const mockIntentService = intentService.intentDetectionService as jest.Mocked<typeof intentService.intentDetectionService>;

describe('Auto-Reply API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/auto-replies', () => {
        it('should return all auto-replies', async () => {
            const mockReplies = [
                {
                    id: 1,
                    name: 'Saudação',
                    intent_description: 'Cliente está cumprimentando',
                    example_messages: ['Olá', 'Oi'],
                    response_template: 'Olá! Como posso ajudar?',
                    is_active: true,
                    priority: 0,
                    confidence_threshold: 0.7,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            ];

            mockRepo.findAll.mockResolvedValue(mockReplies);

            const req = new NextRequest('http://localhost/api/auto-replies');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data).toHaveLength(1);
            expect(data[0].name).toBe('Saudação');
        });

        it('should return only active auto-replies when filtered', async () => {
            const mockActiveReplies = [
                {
                    id: 1,
                    name: 'Saudação',
                    intent_description: 'Cliente está cumprimentando',
                    example_messages: ['Olá'],
                    response_template: 'Olá!',
                    is_active: true,
                    priority: 0,
                    confidence_threshold: 0.7,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            ];

            mockRepo.findActive.mockResolvedValue(mockActiveReplies);

            const req = new NextRequest('http://localhost/api/auto-replies?active=true');
            const res = await GET(req);
            await res.json();

            expect(res.status).toBe(200);
            expect(mockRepo.findActive).toHaveBeenCalled();
        });
    });

    describe('POST /api/auto-replies', () => {
        it('should create a new auto-reply', async () => {
            const newReply = {
                name: 'Pedido de Orçamento',
                intent_description: 'Cliente quer orçamento',
                example_messages: ['Quanto custa?'],
                response_template: 'Vou preparar um orçamento!',
                is_active: true,
                priority: 5,
                confidence_threshold: 0.75,
            };

            const createdReply = {
                id: 2,
                ...newReply,
                created_at: new Date(),
                updated_at: new Date(),
            };

            mockRepo.create.mockResolvedValue(createdReply);

            const req = new NextRequest('http://localhost/api/auto-replies', {
                method: 'POST',
                body: JSON.stringify(newReply),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.id).toBe(2);
            expect(data.name).toBe('Pedido de Orçamento');
        });

        it('should return 400 if required fields are missing', async () => {
            const req = new NextRequest('http://localhost/api/auto-replies', {
                method: 'POST',
                body: JSON.stringify({
                    name: 'Incomplete',
                    // missing intent_description and response_template
                }),
            });

            const res = await POST(req);
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/auto-replies/[id]', () => {
        it('should return auto-reply by id', async () => {
            const mockReply = {
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
            };

            mockRepo.findById.mockResolvedValue(mockReply);

            const req = new NextRequest('http://localhost/api/auto-replies/1');
            const res = await getById(req, { params: Promise.resolve({ id: '1' }) });
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.id).toBe(1);
        });

        it('should return 404 if auto-reply not found', async () => {
            mockRepo.findById.mockResolvedValue(null);

            const req = new NextRequest('http://localhost/api/auto-replies/999');
            const res = await getById(req, { params: Promise.resolve({ id: '999' }) });

            expect(res.status).toBe(404);
        });
    });

    describe('PUT /api/auto-replies/[id]', () => {
        it('should update an existing auto-reply', async () => {
            const updatedData = {
                name: 'Saudação Atualizada',
                intent_description: 'Cliente cumprimentando',
                example_messages: ['Olá', 'Oi', 'Bom dia'],
                response_template: 'Olá! Tudo bem?',
                is_active: true,
                priority: 1,
                confidence_threshold: 0.8,
            };

            const updatedReply = {
                id: 1,
                ...updatedData,
                created_at: new Date(),
                updated_at: new Date(),
            };

            mockRepo.update.mockResolvedValue(updatedReply);

            const req = new NextRequest('http://localhost/api/auto-replies/1', {
                method: 'PUT',
                body: JSON.stringify(updatedData),
            });

            const res = await PUT(req, { params: Promise.resolve({ id: '1' }) });
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.name).toBe('Saudação Atualizada');
            expect(data.confidence_threshold).toBe(0.8);
        });
    });

    describe('DELETE /api/auto-replies/[id]', () => {
        it('should delete an auto-reply', async () => {
            mockRepo.delete.mockResolvedValue(true);

            const req = new NextRequest('http://localhost/api/auto-replies/1');
            const res = await DELETE(req, { params: Promise.resolve({ id: '1' }) });

            expect(res.status).toBe(200);
            expect(mockRepo.delete).toHaveBeenCalledWith(1);
        });

        it('should return 404 if auto-reply to delete not found', async () => {
            mockRepo.delete.mockResolvedValue(false);

            const req = new NextRequest('http://localhost/api/auto-replies/999');
            const res = await DELETE(req, { params: Promise.resolve({ id: '999' }) });

            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/auto-replies/[id]/toggle', () => {
        it('should toggle auto-reply active status', async () => {
            const toggledReply = {
                id: 1,
                name: 'Saudação',
                intent_description: 'Cumprimento',
                example_messages: ['Olá'],
                response_template: 'Olá!',
                is_active: false, // toggled to false
                priority: 0,
                confidence_threshold: 0.7,
                created_at: new Date(),
                updated_at: new Date(),
            };

            mockRepo.toggleActive.mockResolvedValue(toggledReply);

            const req = new NextRequest('http://localhost/api/auto-replies/1/toggle', {
                method: 'POST',
            });

            const res = await toggle(req, { params: Promise.resolve({ id: '1' }) });
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.is_active).toBe(false);
        });
    });

    describe('POST /api/auto-replies/test', () => {
        it('should test intent detection and return result', async () => {
            const mockActiveReplies = [
                {
                    id: 1,
                    name: 'Saudação',
                    intent_description: 'Cliente cumprimentando',
                    example_messages: ['Olá', 'Oi'],
                    response_template: 'Olá {{name}}!',
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

            mockRepo.findActive.mockResolvedValue(mockActiveReplies);
            mockIntentService.detectIntent.mockResolvedValue(mockDetection);

            const req = new NextRequest('http://localhost/api/auto-replies/test', {
                method: 'POST',
                body: JSON.stringify({
                    message: 'Olá, tudo bem?',
                }),
            });

            const res = await test(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.intent).toBe('Saudação');
            expect(data.confidence).toBe(0.95);
            expect(data.meetsThreshold).toBe(true);
            expect(data.response).toContain('Olá');
        });

        it('should return no match if confidence is below threshold', async () => {
            const mockActiveReplies = [
                {
                    id: 1,
                    name: 'Saudação',
                    intent_description: 'Cumprimento',
                    example_messages: ['Olá'],
                    response_template: 'Olá!',
                    is_active: true,
                    priority: 0,
                    confidence_threshold: 0.9, // high threshold
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            ];

            const mockDetection = {
                intent: 'Saudação',
                confidence: 0.5, // low confidence
                autoReplyId: 1,
            };

            mockRepo.findActive.mockResolvedValue(mockActiveReplies);
            mockIntentService.detectIntent.mockResolvedValue(mockDetection);

            const req = new NextRequest('http://localhost/api/auto-replies/test', {
                method: 'POST',
                body: JSON.stringify({
                    message: 'Test message',
                }),
            });

            const res = await test(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.meetsThreshold).toBe(false);
            expect(data.response).toBeNull();
        });
    });

    describe('GET /api/auto-replies/stats', () => {
        it('should return usage statistics', async () => {
            const mockStats = {
                total_sent_today: 10,
                total_sent_week: 50,
                total_sent_month: 200,
                avg_confidence: 0.85,
                by_intent: [
                    { name: 'Saudação', count: 30 },
                    { name: 'Pedido de Orçamento', count: 20 },
                ],
            };

            mockRepo.getStats.mockResolvedValue(mockStats);

            const res = await getStats();
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.total_sent_today).toBe(10);
            expect(data.avg_confidence).toBe(0.85);
            expect(data.by_intent).toHaveLength(2);
        });
    });
});
