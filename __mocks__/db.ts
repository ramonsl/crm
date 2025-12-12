/**
 * Mock for @/lib/db
 * 
 * Provides async PostgreSQL-compatible mock functions
 * that can be configured per test.
 */

// Create mockable async functions
export const mockQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
export const mockQueryOne = jest.fn().mockResolvedValue(undefined);
export const mockExecute = jest.fn().mockResolvedValue({ rowCount: 0 });
export const mockTransaction = jest.fn().mockImplementation(async (callback) => callback(mockPool));
export const mockPoolQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });

export const mockPool = {
    query: mockPoolQuery,
    connect: jest.fn().mockResolvedValue({
        query: mockPoolQuery,
        release: jest.fn(),
    }),
};

// Export the mocked functions
export const pool = mockPool;
export const query = mockQuery;
export const queryOne = mockQueryOne;
export const execute = mockExecute;
export const transaction = mockTransaction;
export const sql = jest.fn((strings: TemplateStringsArray, ...values: any[]) => ({
    text: strings.join('$'),
    values,
}));

// Helper to reset all mocks
export const resetDbMocks = () => {
    mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    mockQueryOne.mockReset().mockResolvedValue(undefined);
    mockExecute.mockReset().mockResolvedValue({ rowCount: 0 });
    mockPoolQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    mockTransaction.mockReset().mockImplementation(async (callback) => callback(mockPool));
};

// Default export for backwards compatibility
export default {
    pool,
    query,
    queryOne,
    execute,
    transaction,
    sql,
    mockQuery,
    mockQueryOne,
    mockExecute,
    mockPoolQuery,
    mockTransaction,
    resetDbMocks,
};
