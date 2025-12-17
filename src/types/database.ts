/**
 * Database Type Definitions
 * 
 * Types for database operations
 */

/**
 * Valid SQL query parameter types
 * Use this instead of any[] for query parameters
 */
export type QueryParams = (string | number | boolean | null | undefined)[];

/**
 * Database query result structure
 */
export interface QueryResult<T> {
    rows: T[];
    rowCount: number;
}

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = (client: DatabaseClient) => Promise<T>;

/**
 * Database client interface (from @neondatabase/serverless)
 */
export interface DatabaseClient {
    query<T = unknown>(queryText: string, params?: QueryParams): Promise<QueryResult<T>>;
    release(): void;
}
