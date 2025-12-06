/**
 * ActivityRepository Tests
 * Unit tests for activity repository - Timeline feature
 * 
 * Follows existing test patterns from templateHistoryRepository.test.ts
 */

import { ActivityRepository } from '@/lib/repositories/ActivityRepository';
import db from '@/lib/db';

// Mock database
jest.mock('@/lib/db', () => ({
    prepare: jest.fn()
}));

// Mock migration
jest.mock('@/lib/migrations/addActivitiesTable', () => ({}));

describe('ActivityRepository', () => {
    let repository: ActivityRepository;

    beforeEach(() => {
        repository = new ActivityRepository(db as any);
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a new activity', () => {
            const mockRun = jest.fn().mockReturnValue({ lastInsertRowid: 1 });
            const mockGet = jest.fn().mockReturnValue({
                id: 1,
                contact_cpf: '12345678900',
                type: 'note',
                subtype: null,
                title: 'Nota adicionada',
                description: 'Test note',
                metadata: null,
                created_at: '2025-12-06T12:00:00Z'
            });

            (db.prepare as jest.Mock)
                .mockReturnValueOnce({ run: mockRun })
                .mockReturnValueOnce({ get: mockGet });

            const result = repository.create({
                contact_cpf: '12345678900',
                type: 'note',
                title: 'Nota adicionada',
                description: 'Test note',
            });

            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO activities')
            );
            expect(result.id).toBe(1);
            expect(result.type).toBe('note');
            expect(result.description).toBe('Test note');
        });

        it('should serialize metadata to JSON', () => {
            const mockRun = jest.fn().mockReturnValue({ lastInsertRowid: 1 });
            const mockGet = jest.fn().mockReturnValue({
                id: 1,
                contact_cpf: '12345678900',
                type: 'status_change',
                subtype: null,
                title: 'Status alterado',
                description: 'NOVO → CONTATO',
                metadata: '{"from":"NOVO","to":"CONTATO"}',
                created_at: '2025-12-06T12:00:00Z'
            });

            (db.prepare as jest.Mock)
                .mockReturnValueOnce({ run: mockRun })
                .mockReturnValueOnce({ get: mockGet });

            repository.create({
                contact_cpf: '12345678900',
                type: 'status_change',
                title: 'Status alterado',
                description: 'NOVO → CONTATO',
                metadata: { from: 'NOVO', to: 'CONTATO' },
            });

            const callArgs = mockRun.mock.calls[0];
            expect(callArgs[5]).toBe('{"from":"NOVO","to":"CONTATO"}');
        });

        it('should handle null subtype', () => {
            const mockRun = jest.fn().mockReturnValue({ lastInsertRowid: 1 });
            const mockGet = jest.fn().mockReturnValue({
                id: 1,
                contact_cpf: '12345678900',
                type: 'note',
                subtype: null,
                title: 'Test',
                description: null,
                metadata: null,
                created_at: '2025-12-06T12:00:00Z'
            });

            (db.prepare as jest.Mock)
                .mockReturnValueOnce({ run: mockRun })
                .mockReturnValueOnce({ get: mockGet });

            repository.create({
                contact_cpf: '12345678900',
                type: 'note',
                title: 'Test',
            });

            const callArgs = mockRun.mock.calls[0];
            expect(callArgs[2]).toBeNull(); // subtype
        });
    });

    describe('findByContact', () => {
        it('should find activities by CPF', () => {
            const mockActivities = [
                {
                    id: 2,
                    contact_cpf: '12345678900',
                    type: 'whatsapp',
                    subtype: 'sent',
                    title: 'WhatsApp enviado',
                    description: 'Hello',
                    metadata: null,
                    created_at: '2025-12-06T12:00:00Z'
                },
                {
                    id: 1,
                    contact_cpf: '12345678900',
                    type: 'lead_created',
                    subtype: null,
                    title: 'Lead criado',
                    description: 'João Silva',
                    metadata: null,
                    created_at: '2025-12-06T11:00:00Z'
                }
            ];

            const mockAll = jest.fn().mockReturnValue(mockActivities);
            (db.prepare as jest.Mock).mockReturnValue({ all: mockAll });

            const results = repository.findByContact('12345678900');

            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM activities')
            );
            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY created_at DESC')
            );
            expect(mockAll).toHaveBeenCalledWith('12345678900', 50);
            expect(results).toHaveLength(2);
            expect(results[0].id).toBe(2);
        });

        it('should respect custom limit', () => {
            const mockAll = jest.fn().mockReturnValue([]);
            (db.prepare as jest.Mock).mockReturnValue({ all: mockAll });

            repository.findByContact('12345678900', 10);

            expect(mockAll).toHaveBeenCalledWith('12345678900', 10);
        });

        it('should return empty array if no activities', () => {
            const mockAll = jest.fn().mockReturnValue([]);
            (db.prepare as jest.Mock).mockReturnValue({ all: mockAll });

            const results = repository.findByContact('12345678900');

            expect(results).toEqual([]);
        });
    });

    describe('findRecent', () => {
        it('should find recent activities without filters', () => {
            const mockAll = jest.fn().mockReturnValue([]);
            (db.prepare as jest.Mock).mockReturnValue({ all: mockAll });

            repository.findRecent();

            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY created_at DESC')
            );
        });

        it('should filter by CPF', () => {
            const mockAll = jest.fn().mockReturnValue([]);
            (db.prepare as jest.Mock).mockReturnValue({ all: mockAll });

            repository.findRecent({ cpf: '12345678900' });

            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('contact_cpf = ?')
            );
        });

        it('should filter by type', () => {
            const mockAll = jest.fn().mockReturnValue([]);
            (db.prepare as jest.Mock).mockReturnValue({ all: mockAll });

            repository.findRecent({ type: 'whatsapp' });

            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('type = ?')
            );
        });

        it('should apply limit and offset', () => {
            const mockAll = jest.fn().mockReturnValue([]);
            (db.prepare as jest.Mock).mockReturnValue({ all: mockAll });

            repository.findRecent({ limit: 10, offset: 20 });

            const query = (db.prepare as jest.Mock).mock.calls[0][0];
            expect(query).toContain('LIMIT ?');
            expect(query).toContain('OFFSET ?');
        });
    });

    describe('countByContact', () => {
        it('should count activities by CPF', () => {
            const mockGet = jest.fn().mockReturnValue({ count: 5 });
            (db.prepare as jest.Mock).mockReturnValue({ get: mockGet });

            const count = repository.countByContact('12345678900');

            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('SELECT COUNT(*)')
            );
            expect(mockGet).toHaveBeenCalledWith('12345678900');
            expect(count).toBe(5);
        });

        it('should return 0 if no activities', () => {
            const mockGet = jest.fn().mockReturnValue({ count: 0 });
            (db.prepare as jest.Mock).mockReturnValue({ get: mockGet });

            const count = repository.countByContact('12345678900');

            expect(count).toBe(0);
        });
    });
});
