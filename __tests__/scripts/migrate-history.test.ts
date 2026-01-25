
import { migrateHistory } from '../../scripts/migrate-history';
import { pool } from '../../src/lib/db';

// Mock the db module
jest.mock('../../src/lib/db', () => ({
    pool: {
        query: jest.fn(),
        end: jest.fn(),
    },
}));

describe('migrateHistory', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should execute the migration query with correct parameters', async () => {
        // Mock responses
        (pool.query as jest.Mock)
            .mockResolvedValueOnce({ rows: [{ history_count: 10, messages_count: 5 }] }) // 1. beforeStats
            .mockResolvedValueOnce({ rows: [{ count: '10' }] })                          // 2. countResult
            .mockResolvedValueOnce({ rowCount: 10 })                                     // 3. migrationResult
            .mockResolvedValueOnce({ rows: [{ messages_count: 15 }] });                  // 4. afterStats

        await migrateHistory();

        // Check if query was called 4 times
        expect(pool.query).toHaveBeenCalledTimes(4);

        // Verify the migration query (3rd call)
        const migrationCall = (pool.query as jest.Mock).mock.calls[2];
        const migrationSQL = migrationCall[0];

        expect(migrationSQL).toContain('INSERT INTO messages');
        expect(migrationSQL).toContain("'migrated_' || mh.id");
        expect(migrationSQL).toContain("FROM message_history mh");
        expect(migrationSQL).toContain("NOT EXISTS");
    });

    it('should handling errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

        await migrateHistory();

        expect(consoleSpy).toHaveBeenCalledWith('❌ Migration failed:', expect.any(Error));
        consoleSpy.mockRestore();
    });
});
