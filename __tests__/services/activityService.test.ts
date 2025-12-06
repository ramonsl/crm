/**
 * ActivityService Tests
 * Unit tests for activity service - Timeline feature
 * 
 * Follows existing test patterns from services tests
 */

import { ActivityService } from '@/services/activityService';
import type { IActivityRepository } from '@/lib/repositories/interfaces';
import type { ActivityRow } from '@/lib/types';
import type { CreateActivityDto } from '@/lib/repositories/dtos';

describe('ActivityService', () => {
    let service: ActivityService;
    let mockRepository: jest.Mocked<IActivityRepository>;

    const mockActivity: ActivityRow = {
        id: 1,
        contact_cpf: '12345678900',
        type: 'note',
        subtype: null,
        title: 'Test',
        description: 'Test description',
        metadata: null,
        created_at: '2025-12-06T12:00:00Z',
    };

    beforeEach(() => {
        mockRepository = {
            findByContact: jest.fn(),
            create: jest.fn().mockReturnValue(mockActivity),
            findRecent: jest.fn(),
            countByContact: jest.fn(),
        };

        service = new ActivityService(mockRepository);
    });

    describe('logWhatsAppSent', () => {
        it('should create whatsapp sent activity', () => {
            service.logWhatsAppSent('12345678900', 'Hello World');

            expect(mockRepository.create).toHaveBeenCalledWith({
                contact_cpf: '12345678900',
                type: 'whatsapp',
                subtype: 'sent',
                title: 'WhatsApp enviado',
                description: 'Hello World',
                metadata: undefined,
            });
        });

        it('should include template name in metadata if provided', () => {
            service.logWhatsAppSent('12345678900', 'Welcome!', 'Boas-vindas');

            expect(mockRepository.create).toHaveBeenCalledWith({
                contact_cpf: '12345678900',
                type: 'whatsapp',
                subtype: 'template',
                title: 'WhatsApp enviado',
                description: 'Welcome!',
                metadata: { templateName: 'Boas-vindas' },
            });
        });

        it('should truncate long messages', () => {
            const longMessage = 'A'.repeat(300);
            service.logWhatsAppSent('12345678900', longMessage);

            const callArgs = mockRepository.create.mock.calls[0][0] as CreateActivityDto;
            expect(callArgs.description?.length).toBeLessThanOrEqual(203);
            expect(callArgs.description).toContain('...');
        });
    });

    describe('logWhatsAppReceived', () => {
        it('should create whatsapp received activity', () => {
            service.logWhatsAppReceived('12345678900', 'Hi there!');

            expect(mockRepository.create).toHaveBeenCalledWith({
                contact_cpf: '12345678900',
                type: 'whatsapp',
                subtype: 'received',
                title: 'WhatsApp recebido',
                description: 'Hi there!',
            });
        });
    });

    describe('logStatusChange', () => {
        it('should create status change activity', () => {
            service.logStatusChange('12345678900', 'NOVO', 'EM_CONTATO');

            expect(mockRepository.create).toHaveBeenCalledWith({
                contact_cpf: '12345678900',
                type: 'status_change',
                title: 'Status alterado',
                description: 'NOVO → EM_CONTATO',
                metadata: { from: 'NOVO', to: 'EM_CONTATO' },
            });
        });
    });

    describe('logNote', () => {
        it('should create note activity', () => {
            service.logNote('12345678900', 'Customer requested callback');

            expect(mockRepository.create).toHaveBeenCalledWith({
                contact_cpf: '12345678900',
                type: 'note',
                title: 'Nota adicionada',
                description: 'Customer requested callback',
            });
        });
    });

    describe('logLeadCreated', () => {
        it('should create lead_created activity', () => {
            service.logLeadCreated('12345678900', 'João Silva');

            expect(mockRepository.create).toHaveBeenCalledWith({
                contact_cpf: '12345678900',
                type: 'lead_created',
                title: 'Lead criado',
                description: 'João Silva',
                metadata: undefined,
            });
        });

        it('should include source in metadata if provided', () => {
            service.logLeadCreated('12345678900', 'João Silva', 'importação');

            expect(mockRepository.create).toHaveBeenCalledWith({
                contact_cpf: '12345678900',
                type: 'lead_created',
                title: 'Lead criado',
                description: 'João Silva',
                metadata: { source: 'importação' },
            });
        });
    });

    describe('logLeadUpdated', () => {
        it('should create lead_updated activity with changed fields', () => {
            service.logLeadUpdated('12345678900', { nome: 'João', email: 'joao@email.com' });

            expect(mockRepository.create).toHaveBeenCalledWith({
                contact_cpf: '12345678900',
                type: 'lead_updated',
                title: 'Dados atualizados',
                description: 'Campos: nome, email',
                metadata: { changes: { nome: 'João', email: 'joao@email.com' } },
            });
        });
    });
});
