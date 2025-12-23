/**
 * Neon PostgreSQL Database Connection
 * 
 * This module provides database connectivity using Neon's serverless driver.
 * Replaces better-sqlite3 for PostgreSQL compatibility.
 */

import { Pool, neon, NeonQueryFunction } from '@neondatabase/serverless';
import { dbLogger } from '@/lib/logger';

// Validate DATABASE_URL is present
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    dbLogger.warn('DATABASE_URL not set - database operations will fail');
}

/**
 * SQL template function for HTTP queries (one-shot queries)
 * Best for: Simple reads, API routes, serverless functions
 * 
 * Usage:
 *   const users = await sql`SELECT * FROM users WHERE id = ${id}`;
 */
// Safely initialize neon - if no connection string, return a dummy function that throws when called
export const sql: NeonQueryFunction<false, false> = connectionString
    ? neon(connectionString)
    : ((...args: any[]) => { throw new Error('DATABASE_URL is not set'); }) as any;

/**
 * Connection Pool for WebSocket queries (session-based)
 * Best for: Complex transactions, multiple queries, real-time features
 * 
 * Usage:
 *   const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
 */
export const pool = new Pool({
    connectionString: connectionString, // Pool allows undefined connectionString in config, but will fail on connect
    max: 10, // Maximum number of connections
});

/**
 * Helper to run a parameterized query
 * Provides compatibility layer for code migrating from better-sqlite3
 * 
 * @param query SQL query with $1, $2, etc. placeholders
 * @param params Array of parameter values
 * @returns Query result rows
 */
export async function query<T = any>(queryText: string, params: any[] = []): Promise<T[]> {
    const result = await pool.query(queryText, params);
    return result.rows as T[];
}

/**
 * Helper to run a query and get the first row
 * 
 * @param queryText SQL query with $1, $2, etc. placeholders
 * @param params Array of parameter values
 * @returns First row or undefined
 */
export async function queryOne<T = any>(queryText: string, params: any[] = []): Promise<T | undefined> {
    const result = await pool.query(queryText, params);
    return result.rows[0] as T | undefined;
}

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 * 
 * @param queryText SQL query with $1, $2, etc. placeholders
 * @param params Array of parameter values
 * @returns Number of affected rows
 */
export async function execute(queryText: string, params: any[] = []): Promise<number> {
    const result = await pool.query(queryText, params);
    return result.rowCount ?? 0;
}

/**
 * Run multiple queries in a transaction
 * 
 * @param callback Function that receives a client and runs queries
 * @returns Result of the callback
 */
export async function transaction<T>(
    callback: (client: any) => Promise<T>
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Close all connections - use on app shutdown
 */
export async function closePool(): Promise<void> {
    await pool.end();
}

dbLogger.debug('Neon PostgreSQL driver initialized');
