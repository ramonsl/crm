/**
 * Production migration to create tags and lead_tags tables
 * Run this after deploying the new schema to production
 */

import { pool } from '../src/lib/neonDb';

async function migrateProductionTables() {
    console.log('🔄 Creating tags and lead_tags tables in production...\n');

    try {
        // Create tags table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tags (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#6b7280',
                description TEXT,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table: tags');

        // Create lead_tags junction table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lead_tags (
                id SERIAL PRIMARY KEY,
                lead_cpf TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_lead_tag_lead FOREIGN KEY (lead_cpf) REFERENCES leads(cpf) ON DELETE CASCADE,
                CONSTRAINT fk_lead_tag_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
                CONSTRAINT unique_lead_tag UNIQUE (lead_cpf, tag_id)
            )
        `);
        console.log('✅ Table: lead_tags');

        console.log('\n✅ Migration complete!');

    } catch (error) {
        console.error('\n❌ Error:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

migrateProductionTables();
