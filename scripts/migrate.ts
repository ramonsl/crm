/**
 * Roda migrations no banco de PRODUÇÃO (ep-crimson-dawn)
 * Usa DATABASE_URL das variáveis de ambiente (Railway)
 * 
 * Uso: npm run migrate:prod
 * Ou automaticamente via GitHub Actions
 */

import { runner } from 'node-pg-migrate';

async function runProductionMigrations() {
    console.log('🔄 Running migrations on PRODUCTION database (ep-crimson-dawn)...\n');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL not set!');
        console.error('Make sure DATABASE_URL environment variable is configured.');
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
            checkOrder: false, // Ignora validação de ordem (migrations antigas podem não ter rodado)
            verbose: true,
            log: (msg: string) => console.log(msg),
        });

        console.log('\n✅ Production database migrations completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

runProductionMigrations();
