/**
 * SQLiteTemplateHistoryRepository Tests
 * Unit tests for template history repository
 */

import { SQLiteTemplateHistoryRepository, TemplateHistoryEntry } from '@/repositories/templateHistoryRepository';
import db from '@/lib/db';

// Mock database
jest.mock('@/lib/db', () => ({
    prepare: jest.fn()
}));

// Mock migration
jest.mock('@/lib/migrations/addTemplateHistory', () => ({}));

describe('SQLiteTemplateHistoryRepository', () => {
    let repository: SQLiteTemplateHistoryRepository;

    beforeEach(() => {
        repository = new SQLiteTemplateHistoryRepository();
        jest.clearAllMocks();
    });

    describe('saveHistory', () => {
        it('should save template history to database', async () => {
            const mockRun = jest.fn();
            (db.prepare as jest.Mock).mockReturnValue({
                run: mockRun
            });

            const entry: Omit<TemplateHistoryEntry, 'id'> = {
                phone: '51999887766',
                template_name: 'Boas-vindas',
                template_content: 'Olá!',
                sent_at: '2025-12-06T10:00:00Z',
                success: true,
                error_message: null
            };

            await repository.saveHistory(entry);

            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO template_history')
            );
            expect(mockRun).toHaveBeenCalledWith(
                '51999887766',
                'Boas-vindas',
                'Olá!',
                '2025-12-06T10:00:00Z',
                1, // success as 1
                null
            );
        });

        it('should save failed send with error message', async () => {
            const mockRun = jest.fn();
            (db.prepare as jest.Mock).mockReturnValue({
                run: mockRun
            });

            const entry: Omit<TemplateHistoryEntry, 'id'> = {
                phone: '51999887766',
                template_name: 'Test',
                template_content: 'Content',
                sent_at: '2025-12-06T10:00:00Z',
                success: false,
                error_message: 'WhatsApp not ready'
            };

            await repository.saveHistory(entry);

            expect(mockRun).toHaveBeenCalledWith(
                '51999887766',
                'Test',
                'Content',
                '2025-12-06T10:00:00Z',
                0, // success as 0
                'WhatsApp not ready'
            );
        });

        it('should convert success boolean to integer', async () => {
            const mockRun = jest.fn();
            (db.prepare as jest.Mock).mockReturnValue({
                run: mockRun
            });

            const entry: Omit<TemplateHistoryEntry, 'id'> = {
                phone: '51999887766',
                template_name: 'Test',
                template_content: 'Content',
                sent_at: '2025-12-06T10:00:00Z',
                success: true,
                error_message: null
            };

            await repository.saveHistory(entry);

            const successParam = mockRun.mock.calls[0][4];
            expect(successParam).toBe(1);
            expect(typeof successParam).toBe('number');
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
                    success: 1,
                    error_message: null
                }
            ];

            const mockAll = jest.fn().mockReturnValue(mockHistory);
            (db.prepare as jest.Mock).mockReturnValue({
                all: mockAll
            });

            const results = await repository.findByPhone('51999887766');

            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('SELECT')
            );
            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('FROM template_history')
            );
            expect(mockAll).toHaveBeenCalledWith('51999887766', '5551999887766', 50);
            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(true); // Converted from 1 to boolean
        });

        it('should try phone variations (with and without country code)', async () => {
            const mockAll = jest.fn().mockReturnValue([]);
            (db.prepare as jest.Mock).mockReturnValue({
                all: mockAll
            });

            await repository.findByPhone('51999887766');

            // Should try both variations
            expect(mockAll).toHaveBeenCalledWith(
                '51999887766',
                '5551999887766',
                50
            );
        });

        it('should accept custom limit', async () => {
            const mockAll = jest.fn().mockReturnValue([]);
            (db.prepare as jest.Mock).mockReturnValue({
                all: mockAll
            });

            await repository.findByPhone('51999887766', 100);

            expect(mockAll).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                100
            );
        });

        it('should return empty array if no history found', async () => {
            const mockAll = jest.fn().mockReturnValue([]);
            (db.prepare as jest.Mock).mockReturnValue({
                all: mockAll
            });

            const results = await repository.findByPhone('51999887766');

            expect(results).toEqual([]);
        });

        it('should order by sent_at DESC', async () => {
            const mockAll = jest.fn().mockReturnValue([]);
            (db.prepare as jest.Mock).mockReturnValue({
                all: mockAll
            });

            await repository.findByPhone('51999887766');

            const query = (db.prepare as jest.Mock).mock.calls[0][0];
            expect(query).toContain('ORDER BY sent_at DESC');
        });

        it('should convert success integer to boolean', async () => {
            const mockHistory = [
                { id: 1, phone: '51999887766', template_name: 'T1', template_content: 'C1', sent_at: '2025-12-06T10:00:00Z', success: 1, error_message: null },
                { id: 2, phone: '51999887766', template_name: 'T2', template_content: 'C2', sent_at: '2025-12-06T11:00:00Z', success: 0, error_message: 'Failed' }
            ];

            const mockAll = jest.fn().mockReturnValue(mockHistory);
            (db.prepare as jest.Mock).mockReturnValue({
                all: mockAll
            });

            const results = await repository.findByPhone('51999887766');

            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(false);
        });
    });

    describe('updateLastTemplate', () => {
        it('should update last template in leads table', async () => {
            const mockRun = jest.fn();
            (db.prepare as jest.Mock).mockReturnValue({
                run: mockRun
            });

            await repository.updateLastTemplate('51999887766', 'Boas-vindas');

            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE leads')
            );
            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('SET last_template_sent = ?')
            );
            expect(mockRun).toHaveBeenCalledWith(
                'Boas-vindas',
                '51999887766',
                '5551999887766' // Should try variations (with country code)
            );
        });

        it('should try phone variations when updating', async () => {
            const mockRun = jest.fn();
            (db.prepare as jest.Mock).mockReturnValue({
                run: mockRun
            });

            await repository.updateLastTemplate('5551999887766', 'Test');

            // Should try both with and without country code
            expect(mockRun).toHaveBeenCalledWith(
                'Test',
                '51999887766',
                '5551999887766' // phoneUtils normalizes first, then adds variation
            );
        });

        it('should update timestamp', async () => {
            const mockRun = jest.fn();
            (db.prepare as jest.Mock).mockReturnValue({
                run: mockRun
            });

            await repository.updateLastTemplate('51999887766', 'Test');

            const query = (db.prepare as jest.Mock).mock.calls[0][0];
            expect(query).toContain('last_template_sent_at = CURRENT_TIMESTAMP');
        });
    });

    describe('getLastTemplateSent', () => {
        it('should return last template name', async () => {
            const mockGet = jest.fn().mockReturnValue({
                last_template_sent: 'Boas-vindas'
            });
            (db.prepare as jest.Mock).mockReturnValue({
                get: mockGet
            });

            const templateName = await repository.getLastTemplateSent('51999887766');

            expect(templateName).toBe('Boas-vindas');
            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('SELECT last_template_sent')
            );
            expect(db.prepare).toHaveBeenCalledWith(
                expect.stringContaining('FROM leads')
            );
        });

        it('should return null if no template sent', async () => {
            const mockGet = jest.fn().mockReturnValue({
                last_template_sent: null
            });
            (db.prepare as jest.Mock).mockReturnValue({
                get: mockGet
            });

            const templateName = await repository.getLastTemplateSent('51999887766');

            expect(templateName).toBeNull();
        });

        it('should return null if contact not found', async () => {
            const mockGet = jest.fn().mockReturnValue(null);
            (db.prepare as jest.Mock).mockReturnValue({
                get: mockGet
            });

            const templateName = await repository.getLastTemplateSent('51999887766');

            expect(templateName).toBeNull();
        });

        it('should try phone variations', async () => {
            const mockGet = jest.fn().mockReturnValue(null);
            (db.prepare as jest.Mock).mockReturnValue({
                get: mockGet
            });

            await repository.getLastTemplateSent('51999887766');

            expect(mockGet).toHaveBeenCalledWith(
                '51999887766',
                '5551999887766' // getPhoneVariations adds country code variation
            );
        });
    });

    describe('Phone normalization', () => {
        it('should remove non-digit characters', async () => {
            const mockAll = jest.fn().mockReturnValue([]);
            (db.prepare as jest.Mock).mockReturnValue({
                all: mockAll
            });

            await repository.findByPhone('(51) 99988-7766');

            expect(mockAll).toHaveBeenCalledWith(
                '51999887766',
                '5551999887766',
                50
            );
        });

        it('should handle phone with country code', async () => {
            const mockAll = jest.fn().mockReturnValue([]);
            (db.prepare as jest.Mock).mockReturnValue({
                all: mockAll
            });

            await repository.findByPhone('5551999887766');

            expect(mockAll).toHaveBeenCalledWith(
                '51999887766', // phoneUtils normalizes first (removes 55)
                '5551999887766', // Then adds variation with country code
                50
            );
        });
    });
});
