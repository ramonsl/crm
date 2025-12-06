/**
 * Database Migration - Add WhatsApp columns to leads table
 * Run this once to add the required columns
 */

import db from '../db';

export function migrateWhatsAppColumns() {
    try {
        console.log('[Migration] Adding WhatsApp columns to leads table...');

        // Check if columns already exist
        const tableInfo = db.prepare("PRAGMA table_info(leads)").all();
        const columnNames = (tableInfo as any[]).map(col => col.name);

        // Add whatsapp_valido if not exists
        if (!columnNames.includes('whatsapp_valido')) {
            db.prepare('ALTER TABLE leads ADD COLUMN whatsapp_valido INTEGER DEFAULT 0').run();
            console.log('[Migration] ✅ Added column: whatsapp_valido');
        }

        // Add profile_picture if not exists
        if (!columnNames.includes('profile_picture')) {
            db.prepare('ALTER TABLE leads ADD COLUMN profile_picture TEXT').run();
            console.log('[Migration] ✅ Added column: profile_picture');
        }

        // Add last_message if not exists
        if (!columnNames.includes('last_message')) {
            db.prepare('ALTER TABLE leads ADD COLUMN last_message TEXT').run();
            console.log('[Migration] ✅ Added column: last_message');
        }

        // Add last_message_time if not exists
        if (!columnNames.includes('last_message_time')) {
            db.prepare('ALTER TABLE leads ADD COLUMN last_message_time TEXT').run();
            console.log('[Migration] ✅ Added column: last_message_time');
        }

        console.log('[Migration] ✅ Migration completed successfully');
        return true;

    } catch (error) {
        console.error('[Migration] ❌ Migration failed:', error);
        return false;
    }
}

// Auto-run migration when module is imported
migrateWhatsAppColumns();
