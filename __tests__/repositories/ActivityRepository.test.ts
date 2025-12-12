/**
 * ActivityRepository Tests
 * Unit tests for activity repository - PostgreSQL async implementation
 */

import { ActivityRepository } from '@/lib/repositories/ActivityRepository';
import { pool } from '@/lib/db';

// Mock database
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn(),
    },
}));

const mockPoolQuery = pool.query as jest.Mock;

describe('ActivityRepository', () => {
    let repository: ActivityRepository;

    beforeEach(() => {
        repository = new ActivityRepository();
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a new activity', async () => {
            const mockActivity = {
                id: 1,
                contact_cpf: '12345678900',
                type: 'note',
                subtype: null,
                title: 'Nota adicionada',
                description: 'Test note',
                metadata: null,
                created_at: '2025-12-06T12:00:00Z'
            };

            mockPoolQuery.mockResolvedValueOnce({ rows: [mockActivity], rowCount: 1 });

            const result = await repository.create({
                contact_cpf: '12345678900',
                type: 'note',
                title: 'Nota adicionada',
                description: 'Test note',
            });

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO activities'),
                expect.arrayContaining(['12345678900', 'note', null, 'Nota adicionada', 'Test note', null])
            );
            expect(result.id).toBe(1);
            expect(result.type).toBe('note');
            expect(result.description).toBe('Test note');
        });

        it('should serialize metadata to JSON', async () => {
            const mockActivity = {
                id: 1,
                contact_cpf: '12345678900',
                type: 'status_change',
                subtype: null,
                title: 'Status alterado',
                description: 'NOVO → CONTATO',
                metadata: '{"from":"NOVO","to":"CONTATO"}',
                created_at: '2025-12-06T12:00:00Z'
            };

            mockPoolQuery.mockResolvedValueOnce({ rows: [mockActivity], rowCount: 1 });

            await repository.create({
                contact_cpf: '12345678900',
                type: 'status_change',
                title: 'Status alterado',
                description: 'NOVO → CONTATO',
                metadata: { from: 'NOVO', to: 'CONTATO' },
            });

            const callArgs = mockPoolQuery.mock.calls[0];
            expect(callArgs[1][5]).toBe('{"from":"NOVO","to":"CONTATO"}');
        });

        it('should handle null subtype', async () => {
            const mockActivity = {
                id: 1,
                contact_cpf: '12345678900',
                type: 'note',
                subtype: null,
                title: 'Test',
                description: null,
                metadata: null,
                created_at: '2025-12-06T12:00:00Z'
            };

            mockPoolQuery.mockResolvedValueOnce({ rows: [mockActivity], rowCount: 1 });

            await repository.create({
                contact_cpf: '12345678900',
                type: 'note',
                title: 'Test',
            });

            const callArgs = mockPoolQuery.mock.calls[0];
            expect(callArgs[1][2]).toBeNull(); // subtype
        });
    });

    describe('findByContact', () => {
        it('should find activities by CPF', async () => {
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

            mockPoolQuery.mockResolvedValueOnce({ rows: mockActivities, rowCount: 2 });

            const results = await repository.findByContact('12345678900');

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM activities'),
                ['12345678900', 50]
            );
            expect(results).toHaveLength(2);
            expect(results[0].id).toBe(2);
        });

        it('should respect custom limit', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await repository.findByContact('12345678900', 10);

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.any(String),
                ['12345678900', 10]
            );
        });

        it('should return empty array if no activities', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            const results = await repository.findByContact('12345678900');

            expect(results).toEqual([]);
        });
    });

    describe('findRecent', () => {
        it('should find recent activities without filters', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await repository.findRecent();

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY created_at DESC'),
                expect.any(Array)
            );
        });

        it('should filter by CPF', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await repository.findRecent({ cpf: '12345678900' });

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('contact_cpf = $'),
                expect.arrayContaining(['12345678900'])
            );
        });

        it('should filter by type', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await repository.findRecent({ type: 'whatsapp' });

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('type = $'),
                expect.arrayContaining(['whatsapp'])
            );
        });

        it('should apply limit and offset', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await repository.findRecent({ limit: 10, offset: 20 });

            const query = mockPoolQuery.mock.calls[0][0];
            expect(query).toContain('LIMIT $');
            expect(query).toContain('OFFSET $');
        });
    });

    describe('countByContact', () => {
        it('should count activities by CPF', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });

            const count = await repository.countByContact('12345678900');

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT COUNT(*)'),
                ['12345678900']
            );
            expect(count).toBe(5);
        });

        it('should return 0 if no activities', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

            const count = await repository.countByContact('12345678900');

            expect(count).toBe(0);
        });
    });
});
