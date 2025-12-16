/**
 * Run migration 008: Create tags tables
 * Creates tags and lead_tags tables for tagging system
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ DATABASE_URL not found in environment');
        console.error('Make sure .env.local exists with DATABASE_URL');
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    console.log('🔄 Running migration 008: Create tags tables...\n');

    try {
        // Create tags table
        console.log('Creating tags table...');
        await sql`
            CREATE TABLE IF NOT EXISTS tags (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE,
                color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                active INTEGER DEFAULT 1
            )
        `;

        // Create lead_tags table
        console.log('Creating lead_tags table...');
        await sql`
            CREATE TABLE IF NOT EXISTS lead_tags (
                id SERIAL PRIMARY KEY,
                lead_cpf TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_lead_tags_lead FOREIGN KEY (lead_cpf) REFERENCES leads(cpf) ON DELETE CASCADE,
                CONSTRAINT fk_lead_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
                CONSTRAINT unique_lead_tag UNIQUE(lead_cpf, tag_id)
            )
        `;

        // Create indexes
        console.log('Creating indexes...');
        await sql`CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_tags_active ON tags(active)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_lead_tags_cpf ON lead_tags(lead_cpf)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_lead_tags_tag_id ON lead_tags(tag_id)`;

        // Insert seed data
        console.log('Inserting seed tags...');
        await sql`
            INSERT INTO tags (name, color, description) VALUES
                ('VIP', '#ef4444', 'Cliente VIP com alta prioridade'),
                ('Urgente', '#f59e0b', 'Necessita atendimento urgente'),
                ('Potencial Alto', '#10b981', 'Alto potencial de conversão'),
                ('Follow-up', '#3b82f6', 'Aguardando retorno'),
                ('Primeiro Contato', '#8b5cf6', 'Primeira interação com o lead')
            ON CONFLICT (name) DO NOTHING
        `;

        console.log('\n✅ Migration 008 completed successfully!');

        // Verify tables were created
        const tags = await sql`SELECT COUNT(*) as count FROM tags`;
        const leadTags = await sql`SELECT COUNT(*) as count FROM lead_tags`;

        console.log(`\n📊 Verification:`);
        console.log(`  - tags table: ${tags[0].count} rows`);
        console.log(`  - lead_tags table: ${leadTags[0].count} rows`);

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
