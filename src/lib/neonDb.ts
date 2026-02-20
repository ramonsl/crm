/**
 * Database Connection Layer
 *
 * Uses the pure `pg` driver for connection pooling on long-lived Node.js servers
 * (Railway). The @neondatabase/serverless Pool uses WebSocket which is dropped by
 * Railway/Neon on idle, causing ETIMEDOUT errors.
 *
 * The `sql` tag (HTTP) still uses @neondatabase/serverless neon() for compatibility.
 */

import { Pool, PoolClient } from 'pg';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { dbLogger } from '@/lib/logger';

// Validate DATABASE_URL is present
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    dbLogger.warn('DATABASE_URL not set - database operations will fail');
}

/**
 * SQL template tag for one-shot HTTP queries (serverless-friendly).
 * Keep using @neondatabase/serverless neon() for simple, stateless queries.
 *
 * Usage:
 *   const users = await sql`SELECT * FROM users WHERE id = ${id}`;
 */
export const sql: NeonQueryFunction<false, false> = connectionString
    ? neon(connectionString)
    : ((..._args: unknown[]) => { throw new Error('DATABASE_URL is not set'); }) as unknown as NeonQueryFunction<false, false>;

/**
 * Connection Pool using the pure `pg` driver.
 *
 * Configured for Railway (persistent Node.js server):
 * - max: 10   — adequate for Railway's single-instance plan
 * - keepAlive — prevents ETIMEDOUT from idle TCP connection drops
 * - idleTimeoutMillis, connectionTimeoutMillis — fail fast if pool exhausted
 */
export const pool = new Pool({
    connectionString,
    max: 10,
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});

// ============================================================================
// ERROR HANDLING & RESILIENCE
// ============================================================================

pool.on('error', (err: Error) => {
    dbLogger.error('Unexpected pool error — connection may have been terminated', {
        error: err.message,
        timestamp: new Date().toISOString(),
    });
    // Do NOT throw — let pg handle reconnection automatically
});

pool.on('connect', () => {
    dbLogger.debug('New client connected to pool', {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
    });
});

pool.on('remove', () => {
    dbLogger.debug('Client removed from pool', {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
    });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Run a parameterized query and return all rows.
 */
export async function query<T = Record<string, unknown>>(queryText: string, params: unknown[] = []): Promise<T[]> {
    const result = await pool.query(queryText, params);
    return result.rows as T[];
}

/**
 * Run a query and return the first row, or undefined if no results.
 */
export async function queryOne<T = Record<string, unknown>>(queryText: string, params: unknown[] = []): Promise<T | undefined> {
    const result = await pool.query(queryText, params);
    return result.rows[0] as T | undefined;
}

/**
 * Execute a mutating query (INSERT, UPDATE, DELETE) and return affected row count.
 */
export async function execute(queryText: string, params: unknown[] = []): Promise<number> {
    const result = await pool.query(queryText, params);
    return result.rowCount ?? 0;
}

/**
 * Run multiple queries atomically within a transaction.
 * Automatically commits on success and rolls back on error.
 */
export async function transaction<T>(
    callback: (client: PoolClient) => Promise<T>
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
 * Gracefully close all pool connections — call on app shutdown.
 */
export async function closePool(): Promise<void> {
    await pool.end();
}

dbLogger.debug('pg Pool initialized (Railway-stable)');
