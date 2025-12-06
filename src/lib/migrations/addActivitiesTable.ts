/**
 * Database Migration - Add activities table for timeline feature
 * 
 * Follows existing migration pattern used in addWhatsAppColumns.ts
 */

import db from '../db';

export function migrateActivitiesTable() {
    try {
        console.log('[Migration] Creating activities table...');

        // Create activities table if not exists
        db.prepare(`
            CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_cpf TEXT NOT NULL,
                type TEXT NOT NULL,
                subtype TEXT,
                title TEXT NOT NULL,
                description TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (contact_cpf) REFERENCES leads(cpf) ON DELETE CASCADE
            )
        `).run();

        console.log('[Migration] ✅ Activities table created');

        // Create indexes for performance
        try {
            db.prepare('CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_cpf, created_at DESC)').run();
            console.log('[Migration] ✅ Index idx_activities_contact created');
        } catch (e) {
            console.debug('[Migration] Index idx_activities_contact already exists');
        }

        try {
            db.prepare('CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type)').run();
            console.log('[Migration] ✅ Index idx_activities_type created');
        } catch (e) {
            console.debug('[Migration] Index idx_activities_type already exists');
        }

        console.log('[Migration] ✅ Activities migration completed successfully');
        return true;

    } catch (error) {
        console.error('[Migration] ❌ Activities migration failed:', error);
        return false;
    }
}

// Auto-run migration when module is imported
migrateActivitiesTable();
