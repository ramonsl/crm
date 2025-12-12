/**
 * Mock for @/lib/neonDb
 * 
 * Mocks the Neon PostgreSQL connection pool and utilities
 */

export const mockPoolQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });

export const pool = {
    query: mockPoolQuery,
    connect: jest.fn().mockResolvedValue({
        query: mockPoolQuery,
        release: jest.fn(),
    }),
};

export const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
export const queryOne = jest.fn().mockResolvedValue(undefined);
export const execute = jest.fn().mockResolvedValue({ rowCount: 0 });
export const transaction = jest.fn().mockImplementation(async (callback) => callback(pool));
export const sql = jest.fn((strings: TemplateStringsArray, ...values: any[]) => ({
    text: strings.join('$'),
    values,
}));

export const resetNeonMocks = () => {
    mockPoolQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    queryOne.mockReset().mockResolvedValue(undefined);
    execute.mockReset().mockResolvedValue({ rowCount: 0 });
};

export default {
    pool,
    query,
    queryOne,
    execute,
    transaction,
    sql,
};
