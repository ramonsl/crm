/**
 * Run migration 007: Create message_history table
 * This migration adds the message_history table for tracking sent messages
 */

const { neon } = require('@neondatabase/serverless');

async function runMigration() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ DATABASE_URL not found in environment');
        console.error('Make sure .env.local exists with DATABASE_URL');
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    console.log('🔄 Running migration 007: Create message_history table...\n');

    try {
        // Create message_history table
        await sql`
            CREATE TABLE IF NOT EXISTS message_history (
                id SERIAL PRIMARY KEY,
                contact_cpf TEXT NOT NULL,
                template_id INTEGER,
                template_name TEXT NOT NULL,
                message_content TEXT NOT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'sent',
                CONSTRAINT fk_message_history_contact FOREIGN KEY (contact_cpf) REFERENCES leads(cpf) ON DELETE CASCADE,
                CONSTRAINT fk_message_history_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
            )
        `;
        console.log('✅ Table message_history created');

        // Create indexes
        await sql`CREATE INDEX IF NOT EXISTS idx_message_history_cpf ON message_history(contact_cpf)`;
        console.log('✅ Index idx_message_history_cpf created');

        await sql`CREATE INDEX IF NOT EXISTS idx_message_history_sent_at ON message_history(sent_at DESC)`;
        console.log('✅ Index idx_message_history_sent_at created');

        console.log('\n🎉 Migration 007 completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

// Load .env.local
require('dotenv').config({ path: '.env.local' });
runMigration();
