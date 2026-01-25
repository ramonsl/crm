import { pool } from '../src/lib/db';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

export async function migrateHistory() {
    console.log('🚀 Starting message history migration...');

    try {
        // 1. Get stats before migration
        const beforeStats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM message_history) as history_count,
                (SELECT COUNT(*) FROM messages) as messages_count
        `);
        console.log('📊 Stats before:', beforeStats.rows[0]);

        // 2. Perform the migration
        // We select from message_history, join with leads to get the phone number,
        // and insert into messages only if the record doesn't exist (using logic or ID/content match)
        // Since message_history doesn't have a unique ID that maps 1:1 to messages easily for legacy data,
        // we'll generate a deterministic ID based on the history ID.

        // Note: message_history has 'id' serial.


        // Count total eligible records
        const countResult = await pool.query(`
            SELECT COUNT(*) 
            FROM message_history mh
            JOIN leads l ON l.cpf = mh.contact_cpf
            WHERE l.telefone IS NOT NULL AND l.telefone != ''
        `);
        const totalToProcess = parseInt(countResult.rows[0].count);
        console.log(`📝 Found ${totalToProcess} potential records to migrate.`);

        // Simpler one-shot query for reliability if dataset isn't huge (usually < 100k for this CRM size likely)
        // If it looks huge, we can kill and optimize.

        console.log("⚡ Executing one-shot migration query (safe for < 100k records)...");

        const migrationResult = await pool.query(`
             INSERT INTO messages (id, contact_phone, content, from_me, type, timestamp, provider, template_id)
                SELECT 
                    'migrated_' || mh.id,     -- Deterministic ID
                    REGEXP_REPLACE(l.telefone, '\\D', '', 'g'), -- Clean phone just in case
                    mh.message_content,       -- Content
                    true,                     -- from_me
                    'text',                   -- type
                    mh.sent_at,               -- timestamp
                    'system_migration',       -- provider
                    NULL                      -- template_id (set to NULL to avoid FK violation with ycloud_templates)
                FROM message_history mh
                JOIN leads l ON l.cpf = mh.contact_cpf
                WHERE l.telefone IS NOT NULL 
                AND l.telefone != ''
                AND NOT EXISTS (
                    SELECT 1 FROM messages m WHERE m.id = ('migrated_' || mh.id)
                )
        `);

        console.log(`✅ Migrated ${migrationResult.rowCount} records.`);

        // 3. Stats after
        const afterStats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM messages) as messages_count
        `);
        console.log('📊 Stats after:', afterStats.rows[0]);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        // Only close pool if running as main script, otherwise let test handle it
        if (require.main === module) {
            await pool.end();
        }
    }
}

// Run if called directly
if (require.main === module) {
    migrateHistory();
}
