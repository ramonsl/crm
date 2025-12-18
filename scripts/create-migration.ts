/**
 * Helper para criar nova migration
 * 
 * Uso: npm run migrate:create -- add_column_to_leads
 */

import { execSync } from 'child_process';

const migrationName = process.argv[2];

if (!migrationName) {
    console.error('❌ Usage: npm run migrate:create -- <migration_name>');
    console.error('Example: npm run migrate:create -- add_email_verified_column');
    process.exit(1);
}

try {
    console.log(`🔄 Creating migration: ${migrationName}...\n`);

    execSync(`npx node-pg-migrate create ${migrationName}`, { stdio: 'inherit' });

    console.log(`\n✅ Migration created successfully!`);
    console.log(`📝 Edit it in migrations/ directory.`);
    console.log(`\nNext steps:`);
    console.log(`1. Edit the migration file`);
    console.log(`2. Test: npm run migrate:test`);
    console.log(`3. Commit and push (CI/CD will apply to production)`);
} catch (error) {
    console.error('❌ Failed to create migration:', error);
    process.exit(1);
}
