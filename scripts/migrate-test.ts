/**
 * Roda migrations no banco de TESTE/DEV (ep-winter-wind)
 * Usa DATABASE_URL do .env.local
 * 
 * Uso: npm run migrate:test
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { runner } from 'node-pg-migrate';

// Carrega .env.local (banco de teste)
config({ path: resolve(process.cwd(), '.env.local') });

async function runTestMigrations() {
    console.log('🔄 Running migrations on TEST database (ep-winter-wind)...\n');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL not set in .env.local!');
        process.exit(1);
    }

    console.log(`📍 DATABASE_URL: ${process.env.DATABASE_URL.substring(0, 50)}...\n`);

    try {
        await runner({
            databaseUrl: process.env.DATABASE_URL,
            dir: 'migrations',
            direction: 'up',
            migrationsTable: 'pgmigrations',
            count: Infinity, // Roda todas as migrations pendentes
            verbose: true,
            log: (msg: string) => console.log(msg),
        });

        console.log('\n✅ Test database migrations completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

runTestMigrations();
