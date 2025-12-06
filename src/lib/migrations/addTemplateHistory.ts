/**
 * Database Migration - Add Template History table
 * Tracks templates sent to contacts
 */

import db from '../db';

export function migrateTemplateHistory() {
    try {
        console.log('[Migration] Adding template_history table...');

        // Create template_history table
        db.exec(`
            CREATE TABLE IF NOT EXISTS template_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT NOT NULL,
                template_name TEXT NOT NULL,
                template_content TEXT,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                success BOOLEAN DEFAULT 1,
                error_message TEXT
            );
            
            CREATE INDEX IF NOT EXISTS idx_template_history_phone 
            ON template_history(phone);
            
            CREATE INDEX IF NOT EXISTS idx_template_history_sent_at 
            ON template_history(sent_at DESC);
            
            CREATE INDEX IF NOT EXISTS idx_template_history_phone_sent_at 
            ON template_history(phone, sent_at DESC);
        `);

        console.log('[Migration] ✅ Created table: template_history');

        // Add columns to leads table
        const tableInfo = db.prepare("PRAGMA table_info(leads)").all() as any[];
        const columns = tableInfo.map(col => col.name);

        if (!columns.includes('last_template_sent')) {
            db.exec('ALTER TABLE leads ADD COLUMN last_template_sent TEXT');
            console.log('[Migration] ✅ Added column: last_template_sent');
        }

        if (!columns.includes('last_template_sent_at')) {
            db.exec('ALTER TABLE leads ADD COLUMN last_template_sent_at TIMESTAMP');
            console.log('[Migration] ✅ Added column: last_template_sent_at');
        }

        console.log('[Migration] ✅ Template history migration completed successfully');
        return true;

    } catch (error) {
        console.error('[Migration] ❌ Template history migration failed:', error);
        return false;
    }
}

// Auto-run migration when module is imported
migrateTemplateHistory();
