"use strict";
/**
 * Neon PostgreSQL Database Connection
 *
 * This module provides database connectivity using Neon's serverless driver.
 * Replaces better-sqlite3 for PostgreSQL compatibility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = exports.sql = void 0;
exports.query = query;
exports.queryOne = queryOne;
exports.execute = execute;
exports.transaction = transaction;
exports.closePool = closePool;
const serverless_1 = require("@neondatabase/serverless");
// Validate DATABASE_URL is present
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.warn('[DB] DATABASE_URL not set - database operations will fail');
}
/**
 * SQL template function for HTTP queries (one-shot queries)
 * Best for: Simple reads, API routes, serverless functions
 *
 * Usage:
 *   const users = await sql`SELECT * FROM users WHERE id = ${id}`;
 */
// Safely initialize neon - if no connection string, return a dummy function that throws when called
exports.sql = connectionString
    ? (0, serverless_1.neon)(connectionString)
    : ((...args) => { throw new Error('DATABASE_URL is not set'); });
/**
 * Connection Pool for WebSocket queries (session-based)
 * Best for: Complex transactions, multiple queries, real-time features
 *
 * Usage:
 *   const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
 */
exports.pool = new serverless_1.Pool({
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
async function query(queryText, params = []) {
    const result = await exports.pool.query(queryText, params);
    return result.rows;
}
/**
 * Helper to run a query and get the first row
 *
 * @param queryText SQL query with $1, $2, etc. placeholders
 * @param params Array of parameter values
 * @returns First row or undefined
 */
async function queryOne(queryText, params = []) {
    const result = await exports.pool.query(queryText, params);
    return result.rows[0];
}
/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 *
 * @param queryText SQL query with $1, $2, etc. placeholders
 * @param params Array of parameter values
 * @returns Number of affected rows
 */
async function execute(queryText, params = []) {
    var _a;
    const result = await exports.pool.query(queryText, params);
    return (_a = result.rowCount) !== null && _a !== void 0 ? _a : 0;
}
/**
 * Run multiple queries in a transaction
 *
 * @param callback Function that receives a client and runs queries
 * @returns Result of the callback
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
 * Close all connections - use on app shutdown
 */
async function closePool() {
    await exports.pool.end();
}
console.log('[DB] Neon PostgreSQL driver initialized');
