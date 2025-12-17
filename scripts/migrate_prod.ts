/**
 * Production Migration Script
 * 
 * Usage:
 * DATABASE_URL='...' npx ts-node -O '{"module":"commonjs"}' scripts/migrate_prod.ts
 * 
 * This script is intended to be run by CI/CD pipelines (GitHub Actions)
 * to apply schema changes to the Production database.
 */

import { initializeDatabase, pool } from '../src/lib/db';

async function migrate() {
    console.log('🚀 Starting Production Database Migration...');

    // 1. Verify Environment
    if (!process.env.DATABASE_URL) {
        console.error('❌ Error: DATABASE_URL is required for migration');
        process.exit(1);
    }

    // Safety check: Ensure we are likely in a production-like environment or explicitly acknowledge
    // (Optional: check for specific env var to confirm intent, but DATABASE_URL presence in CI is standard)

    console.log('Target DB Host:', process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'Unknown');

    try {
        // 2. Run Initialization (Idempotent Schema Creation)
        await initializeDatabase();

        console.log('✅ Migration completed successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
