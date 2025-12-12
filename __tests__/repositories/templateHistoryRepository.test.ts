/**
 * TemplateHistoryRepository Tests
 * Unit tests for template history repository - PostgreSQL async implementation
 */

import { SQLiteTemplateHistoryRepository, TemplateHistoryEntry } from '@/repositories/templateHistoryRepository';
import { pool } from '@/lib/db';

// Mock database
jest.mock('@/lib/db', () => ({
    pool: {
        query: jest.fn(),
    },
    query: jest.fn(),
    queryOne: jest.fn(),
}));

const mockPoolQuery = pool.query as jest.Mock;

describe('TemplateHistoryRepository (Neon)', () => {
    let repository: SQLiteTemplateHistoryRepository;

    beforeEach(() => {
        repository = new SQLiteTemplateHistoryRepository();
        jest.clearAllMocks();
    });

    describe('saveHistory', () => {
        it('should save template history to database', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            const entry: Omit<TemplateHistoryEntry, 'id'> = {
                phone: '51999887766',
                template_name: 'Boas-vindas',
                template_content: 'Olá!',
                sent_at: '2025-12-06T10:00:00Z',
                success: true,
                error_message: null
            };

            await repository.saveHistory(entry);

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO template_history'),
                expect.arrayContaining(['51999887766', 'Boas-vindas', 'Olá!', '2025-12-06T10:00:00Z', true, null])
            );
        });

        it('should save failed send with error message', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            const entry: Omit<TemplateHistoryEntry, 'id'> = {
                phone: '51999887766',
                template_name: 'Test',
                template_content: 'Content',
                sent_at: '2025-12-06T10:00:00Z',
                success: false,
                error_message: 'WhatsApp not ready'
            };

            await repository.saveHistory(entry);

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([false, 'WhatsApp not ready'])
            );
        });
    });

    describe('findByPhone', () => {
        it('should find history by phone number', async () => {
            const mockHistory = [
                {
                    id: 1,
                    phone: '51999887766',
                    template_name: 'Boas-vindas',
                    template_content: 'Olá',
                    sent_at: '2025-12-06T10:00:00Z',
                    success: true,
                    error_message: null
                }
            ];

            mockPoolQuery.mockResolvedValueOnce({ rows: mockHistory, rowCount: 1 });

            const results = await repository.findByPhone('51999887766');

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.any(Array)
            );
            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(true);
        });

        it('should return empty array if no history found', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            const results = await repository.findByPhone('51999887766');

            expect(results).toEqual([]);
        });

        it('should order by sent_at DESC', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await repository.findByPhone('51999887766');

            const query = mockPoolQuery.mock.calls[0][0];
            expect(query).toContain('ORDER BY sent_at DESC');
        });

        it('should convert success integer to boolean', async () => {
            const mockHistory = [
                { id: 1, phone: '51999887766', template_name: 'T1', template_content: 'C1', sent_at: '2025-12-06T10:00:00Z', success: 1, error_message: null },
                { id: 2, phone: '51999887766', template_name: 'T2', template_content: 'C2', sent_at: '2025-12-06T11:00:00Z', success: 0, error_message: 'Failed' }
            ];

            mockPoolQuery.mockResolvedValueOnce({ rows: mockHistory, rowCount: 2 });

            const results = await repository.findByPhone('51999887766');

            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(false);
        });
    });

    describe('updateLastTemplate', () => {
        it('should update last template in leads table', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            await repository.updateLastTemplate('51999887766', 'Boas-vindas');

            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE leads'),
                expect.arrayContaining(['Boas-vindas'])
            );
        });

        it('should update timestamp', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            await repository.updateLastTemplate('51999887766', 'Test');

            const query = mockPoolQuery.mock.calls[0][0];
            expect(query).toContain('last_template_sent_at = CURRENT_TIMESTAMP');
        });
    });

    describe('getLastTemplateSent', () => {
        it('should return last template name', async () => {
            mockPoolQuery.mockResolvedValueOnce({
                rows: [{ last_template_sent: 'Boas-vindas' }],
                rowCount: 1
            });

            const templateName = await repository.getLastTemplateSent('51999887766');

            expect(templateName).toBe('Boas-vindas');
            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT last_template_sent'),
                expect.any(Array)
            );
        });

        it('should return null if no template sent', async () => {
            mockPoolQuery.mockResolvedValueOnce({
                rows: [{ last_template_sent: null }],
                rowCount: 1
            });

            const templateName = await repository.getLastTemplateSent('51999887766');

            expect(templateName).toBeNull();
        });

        it('should return null if contact not found', async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            const templateName = await repository.getLastTemplateSent('51999887766');

            expect(templateName).toBeNull();
        });
    });
});
