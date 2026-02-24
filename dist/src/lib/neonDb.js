"use strict";
/**
 * Database Connection Layer
 *
 * Uses the pure `pg` driver for connection pooling on long-lived Node.js servers
 * (Railway). The @neondatabase/serverless Pool uses WebSocket which is dropped by
 * Railway/Neon on idle, causing ETIMEDOUT errors.
 *
 * The `sql` tag (HTTP) still uses @neondatabase/serverless neon() for compatibility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = exports.sql = void 0;
exports.query = query;
exports.queryOne = queryOne;
exports.execute = execute;
exports.transaction = transaction;
exports.closePool = closePool;
const pg_1 = require("pg");
const serverless_1 = require("@neondatabase/serverless");
const logger_1 = require("../lib/logger");
// Validate DATABASE_URL is present
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    logger_1.dbLogger.warn('DATABASE_URL not set - database operations will fail');
}
/**
 * SQL template tag for one-shot HTTP queries (serverless-friendly).
 * Keep using @neondatabase/serverless neon() for simple, stateless queries.
 *
 * Usage:
 *   const users = await sql`SELECT * FROM users WHERE id = ${id}`;
 */
exports.sql = connectionString
    ? (0, serverless_1.neon)(connectionString)
    : ((..._args) => { throw new Error('DATABASE_URL is not set'); });
/**
 * Connection Pool using the pure `pg` driver.
 *
 * Configured for Railway (persistent Node.js server):
 * - max: 10   — adequate for Railway's single-instance plan
 * - keepAlive — prevents ETIMEDOUT from idle TCP connection drops
 * - idleTimeoutMillis, connectionTimeoutMillis — fail fast if pool exhausted
 */
exports.pool = new pg_1.Pool({
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
exports.pool.on('error', (err) => {
    logger_1.dbLogger.error('Unexpected pool error — connection may have been terminated', {
        error: err.message,
        timestamp: new Date().toISOString(),
    });
    // Do NOT throw — let pg handle reconnection automatically
});
exports.pool.on('connect', () => {
    logger_1.dbLogger.debug('New client connected to pool', {
        totalCount: exports.pool.totalCount,
        idleCount: exports.pool.idleCount,
        waitingCount: exports.pool.waitingCount,
    });
});
exports.pool.on('remove', () => {
    logger_1.dbLogger.debug('Client removed from pool', {
        totalCount: exports.pool.totalCount,
        idleCount: exports.pool.idleCount,
        waitingCount: exports.pool.waitingCount,
    });
});
// ============================================================================
// QUERY HELPERS
// ============================================================================
/**
 * Run a parameterized query and return all rows.
 */
async function query(queryText, params = []) {
    const result = await exports.pool.query(queryText, params);
    return result.rows;
}
/**
 * Run a query and return the first row, or undefined if no results.
 */
async function queryOne(queryText, params = []) {
    const result = await exports.pool.query(queryText, params);
    return result.rows[0];
}
/**
 * Execute a mutating query (INSERT, UPDATE, DELETE) and return affected row count.
 */
async function execute(queryText, params = []) {
    var _a;
    const result = await exports.pool.query(queryText, params);
    return (_a = result.rowCount) !== null && _a !== void 0 ? _a : 0;
}
/**
 * Run multiple queries atomically within a transaction.
 * Automatically commits on success and rolls back on error.
 */
async function transaction(callback) {
    const client = await exports.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * Gracefully close all pool connections — call on app shutdown.
 */
async function closePool() {
    await exports.pool.end();
}
logger_1.dbLogger.debug('pg Pool initialized (Railway-stable)');
