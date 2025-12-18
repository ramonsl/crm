/**
 * Rollback da última migration
 * Usa DATABASE_URL do ambiente
 * 
 * Uso: 
 * - Test: DATABASE_URL=... ts-node scripts/rollback.ts
 * - Prod: DATABASE_URL=... ts-node scripts/rollback.ts
 */

import { runner } from 'node-pg-migrate';

async function rollback() {
    const env = process.env.NODE_ENV || 'development';
    console.log(`🔄 Rolling back last migration (${env})...\n`);

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL not set!');
        console.error('Usage: DATABASE_URL=<url> ts-node scripts/rollback.ts');
        process.exit(1);
    }

    console.log(`📍 DATABASE_URL: ${process.env.DATABASE_URL.substring(0, 50)}...\n`);

    try {
        await runner({
            databaseUrl: process.env.DATABASE_URL,
            dir: 'migrations',
            direction: 'down',
            migrationsTable: 'pgmigrations',
            count: 1, // Rollback apenas a última migration
            verbose: true,
            log: (msg: string) => console.log(msg),
        });

        console.log('\n✅ Rollback completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Rollback failed:', error);
        process.exit(1);
    }
}

rollback();
