#!/usr/bin/env node

/**
 * Database Migration Runner
 * Runs SQL migrations against the configured database
 */

const { Pool } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        console.error('❌ ERROR: DATABASE_URL not found in environment variables');
        console.error('Please configure DATABASE_URL in .env.local');
        process.exit(1);
    }

    console.log('🔗 Connecting to database...');

    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        // Test connection
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful\n');

        // Get migration file
        const migrationFile = path.join(__dirname, '../migrations/005_create_auto_replies.sql');

        if (!fs.existsSync(migrationFile)) {
            console.error(`❌ Migration file not found: ${migrationFile}`);
            process.exit(1);
        }

        console.log(`📄 Reading migration: ${path.basename(migrationFile)}`);
        const migrationSql = fs.readFileSync(migrationFile, 'utf8');

        console.log('⚡ Executing migration...\n');
        await pool.query(migrationSql);

        console.log('✅ Migration executed successfully!');
        console.log('\n📊 Tables created:');
        console.log('  - auto_replies');
        console.log('  - auto_reply_logs');
        console.log('\n🎉 Auto-reply system is ready to use!');

    } catch (error) {
        console.error('\n❌ Migration failed:');
        console.error(error.message);

        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Tip: Check if your database is running and DATABASE_URL is correct');
        } else if (error.code === '42P07') {
            console.log('\n⚠️  Tables already exist. Migration may have run previously.');
        }

        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
