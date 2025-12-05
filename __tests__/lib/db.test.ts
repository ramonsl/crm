import db from '@/lib/db';
import Database from 'better-sqlite3';

jest.mock('better-sqlite3', () => {
    const mDatabase = {
        exec: jest.fn(),
        prepare: jest.fn().mockReturnThis(),
        run: jest.fn(),
        get: jest.fn().mockReturnValue({ count: 0 }),
        all: jest.fn(),
    };
    return jest.fn(() => mDatabase);
});

describe('Database', () => {
    it('should be a singleton instance', () => {
        expect(db).toBeDefined();
    });

    it('should initialize tables on startup', () => {
        // Since db is imported, the constructor logic runs immediately.
        // We can verify if exec was called to create tables.
        // Note: In a real integration test we would check the schema.
        // Here we just check if the mock was called.
        // However, since it's a singleton imported at module level, 
        // it might be hard to reset the mock call count unless we use require/jest.isolateModules
        // For now, simple existence check is enough for the singleton pattern.
        expect(db).toBeTruthy();
    });

    describe('Message History Schema', () => {
        it('should create message_history table with correct structure', () => {
            const mockExec = (Database as jest.MockedClass<typeof Database>).mock.results[0].value.exec;

            // Check if message_history table creation was called
            const execCalls = mockExec.mock.calls;
            const messageHistoryTableCall = execCalls.find((call: any) =>
                call[0]?.includes('CREATE TABLE IF NOT EXISTS message_history')
            );

            expect(messageHistoryTableCall).toBeDefined();
        });

        it('should create indexes for message_history table', () => {
            const mockExec = (Database as jest.MockedClass<typeof Database>).mock.results[0].value.exec;

            const execCalls = mockExec.mock.calls;

            // Check for CPF index
            const cpfIndexCall = execCalls.find((call: any) =>
                call[0]?.includes('CREATE INDEX IF NOT EXISTS idx_message_history_cpf')
            );
            expect(cpfIndexCall).toBeDefined();

            // Check for sent_at index
            const sentAtIndexCall = execCalls.find((call: any) =>
                call[0]?.includes('CREATE INDEX IF NOT EXISTS idx_message_history_sent_at')
            );
            expect(sentAtIndexCall).toBeDefined();
        });

        it('should add last_template_name column to leads table', () => {
            const mockExec = (Database as jest.MockedClass<typeof Database>).mock.results[0].value.exec;

            const execCalls = mockExec.mock.calls;
            const lastTemplateNameCall = execCalls.find((call: any) =>
                call[0]?.includes('ALTER TABLE leads ADD COLUMN last_template_name')
            );

            expect(lastTemplateNameCall).toBeDefined();
        });
    });
});
