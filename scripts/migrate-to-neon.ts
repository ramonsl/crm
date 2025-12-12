/**
 * Migration Script: SQLite to Neon PostgreSQL
 * 
 * This script reads data from the local SQLite database (crm.db)
 * and imports it into the Neon PostgreSQL database.
 * 
 * Run with: npx ts-node scripts/migrate-to-neon.ts
 */

import Database from 'better-sqlite3';
import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SQLITE_PATH = path.join(process.cwd(), 'crm.db');

async function migrate() {
    console.log('🚀 Starting SQLite to Neon PostgreSQL migration...\n');

    // Connect to SQLite
    console.log(`📂 Opening SQLite database: ${SQLITE_PATH}`);
    const sqlite = new Database(SQLITE_PATH);

    // Connect to Neon PostgreSQL
    console.log('🔗 Connecting to Neon PostgreSQL...');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        // Test connection
        await pool.query('SELECT 1');
        console.log('✅ Connected to Neon PostgreSQL\n');

        // Create tables if they don't exist
        await createTables(pool);

        // Migrate each table
        await migrateLeads(sqlite, pool);
        await migrateTemplates(sqlite, pool);
        await migrateStatuses(sqlite, pool);
        await migrateUsers(sqlite, pool);
        await migrateSessions(sqlite, pool);
        await migrateActivities(sqlite, pool);
        await migrateMessages(sqlite, pool);
        await migrateTemplateHistory(sqlite, pool);
        await migrateSettings(sqlite, pool);

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        sqlite.close();
        await pool.end();
    }
}

async function createTables(pool: Pool) {
    console.log('📋 Creating tables...');

    // Leads table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS leads (
            cpf TEXT PRIMARY KEY,
            nome TEXT,
            email TEXT,
            telefone TEXT,
            tipo_ingresso TEXT,
            status TEXT,
            last_message TEXT,
            unread_count INTEGER DEFAULT 0,
            last_message_time TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_inscricao TIMESTAMP,
            notes TEXT,
            profile_image TEXT,
            curso_interesse TEXT,
            escola TEXT,
            is_new INTEGER DEFAULT 0,
            status_changed INTEGER DEFAULT 0,
            last_import_date TIMESTAMP,
            last_template_name TEXT,
            whatsapp_valido INTEGER DEFAULT 0,
            profile_picture TEXT,
            last_template_sent TEXT,
            last_template_sent_at TIMESTAMP
        )
    `);

    // Templates table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS templates (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'fixed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Settings table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);

    // Statuses table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS statuses (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#6b7280',
            display_order INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Users table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Sessions table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Activities table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS activities (
            id SERIAL PRIMARY KEY,
            contact_cpf TEXT NOT NULL,
            type TEXT NOT NULL,
            subtype TEXT,
            title TEXT NOT NULL,
            description TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Messages table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            contact_phone TEXT NOT NULL,
            content TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            from_me BOOLEAN DEFAULT false,
            type TEXT DEFAULT 'text',
            media_url TEXT,
            read BOOLEAN DEFAULT false
        )
    `);

    // Template history table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS template_history (
            id SERIAL PRIMARY KEY,
            phone TEXT NOT NULL,
            template_name TEXT NOT NULL,
            template_content TEXT,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            success BOOLEAN DEFAULT true,
            error_message TEXT
        )
    `);

    console.log('✅ Tables created\n');
}

async function migrateLeads(sqlite: Database.Database, pool: Pool) {
    console.log('📤 Migrating leads...');

    const leads = sqlite.prepare('SELECT * FROM leads').all() as any[];
    console.log(`   Found ${leads.length} leads`);

    if (leads.length === 0) return;

    let migrated = 0;
    for (const lead of leads) {
        try {
            await pool.query(`
                INSERT INTO leads (cpf, nome, email, telefone, tipo_ingresso, status, last_message, 
                    unread_count, last_message_time, created_at, updated_at, data_inscricao, notes,
                    profile_image, curso_interesse, escola, is_new, status_changed, last_import_date,
                    last_template_name, whatsapp_valido, profile_picture, last_template_sent, last_template_sent_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
                ON CONFLICT (cpf) DO NOTHING
            `, [
                lead.cpf, lead.nome, lead.email, lead.telefone, lead.tipo_ingresso, lead.status,
                lead.last_message, lead.unread_count || 0, lead.last_message_time, lead.created_at,
                lead.updated_at, lead.data_inscricao, lead.notes, lead.profile_image, lead.curso_interesse,
                lead.escola, lead.is_new || 0, lead.status_changed || 0, lead.last_import_date,
                lead.last_template_name, lead.whatsapp_valido || 0, lead.profile_picture,
                lead.last_template_sent, lead.last_template_sent_at
            ]);
            migrated++;
        } catch (e: any) {
            console.log(`   ⚠️ Skipping lead ${lead.cpf}: ${e.message}`);
        }
    }
    console.log(`   ✅ Migrated ${migrated} leads`);
}

async function migrateTemplates(sqlite: Database.Database, pool: Pool) {
    console.log('📤 Migrating templates...');

    try {
        const templates = sqlite.prepare('SELECT * FROM templates').all() as any[];
        console.log(`   Found ${templates.length} templates`);

        for (const template of templates) {
            await pool.query(`
                INSERT INTO templates (id, name, message, type, created_at)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO NOTHING
            `, [template.id, template.name, template.message, template.type, template.created_at]);
        }

        // Reset sequence
        await pool.query(`SELECT setval('templates_id_seq', (SELECT COALESCE(MAX(id), 1) FROM templates))`);
        console.log(`   ✅ Migrated ${templates.length} templates`);
    } catch (e: any) {
        console.log(`   ⚠️ Templates migration skipped: ${e.message}`);
    }
}

async function migrateStatuses(sqlite: Database.Database, pool: Pool) {
    console.log('📤 Migrating statuses...');

    try {
        const statuses = sqlite.prepare('SELECT * FROM statuses').all() as any[];
        console.log(`   Found ${statuses.length} statuses`);

        for (const status of statuses) {
            await pool.query(`
                INSERT INTO statuses (id, name, color, display_order, active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (name) DO NOTHING
            `, [status.id, status.name, status.color, status.display_order, status.active, status.created_at, status.updated_at]);
        }

        // Reset sequence
        await pool.query(`SELECT setval('statuses_id_seq', (SELECT COALESCE(MAX(id), 1) FROM statuses))`);
        console.log(`   ✅ Migrated ${statuses.length} statuses`);
    } catch (e: any) {
        console.log(`   ⚠️ Statuses migration skipped: ${e.message}`);
    }
}

async function migrateUsers(sqlite: Database.Database, pool: Pool) {
    console.log('📤 Migrating users...');

    try {
        const users = sqlite.prepare('SELECT * FROM users').all() as any[];
        console.log(`   Found ${users.length} users`);

        for (const user of users) {
            await pool.query(`
                INSERT INTO users (id, email, password_hash, name, role, active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (email) DO NOTHING
            `, [user.id, user.email, user.password_hash, user.name, user.role, user.active, user.created_at, user.updated_at]);
        }

        // Reset sequence
        await pool.query(`SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users))`);
        console.log(`   ✅ Migrated ${users.length} users`);
    } catch (e: any) {
        console.log(`   ⚠️ Users migration skipped: ${e.message}`);
    }
}

async function migrateSessions(sqlite: Database.Database, pool: Pool) {
    console.log('📤 Migrating sessions...');

    try {
        const sessions = sqlite.prepare('SELECT * FROM sessions').all() as any[];
        console.log(`   Found ${sessions.length} sessions`);

        for (const session of sessions) {
            await pool.query(`
                INSERT INTO sessions (id, user_id, expires_at, created_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO NOTHING
            `, [session.id, session.user_id, session.expires_at, session.created_at]);
        }
        console.log(`   ✅ Migrated ${sessions.length} sessions`);
    } catch (e: any) {
        console.log(`   ⚠️ Sessions migration skipped: ${e.message}`);
    }
}

async function migrateActivities(sqlite: Database.Database, pool: Pool) {
    console.log('📤 Migrating activities...');

    try {
        const activities = sqlite.prepare('SELECT * FROM activities').all() as any[];
        console.log(`   Found ${activities.length} activities`);

        for (const activity of activities) {
            await pool.query(`
                INSERT INTO activities (id, contact_cpf, type, subtype, title, description, metadata, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO NOTHING
            `, [activity.id, activity.contact_cpf, activity.type, activity.subtype, activity.title, activity.description, activity.metadata, activity.created_at]);
        }

        // Reset sequence
        await pool.query(`SELECT setval('activities_id_seq', (SELECT COALESCE(MAX(id), 1) FROM activities))`);
        console.log(`   ✅ Migrated ${activities.length} activities`);
    } catch (e: any) {
        console.log(`   ⚠️ Activities migration skipped: ${e.message}`);
    }
}

async function migrateMessages(sqlite: Database.Database, pool: Pool) {
    console.log('📤 Migrating messages...');

    try {
        const messages = sqlite.prepare('SELECT * FROM messages').all() as any[];
        console.log(`   Found ${messages.length} messages`);

        let migrated = 0;
        for (const msg of messages) {
            try {
                await pool.query(`
                    INSERT INTO messages (id, contact_phone, content, timestamp, from_me, type, media_url, read)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO NOTHING
                `, [msg.id, msg.contact_phone, msg.content, msg.timestamp, msg.from_me === 1, msg.type, msg.media_url, msg.read === 1]);
                migrated++;
            } catch (e) {
                // Skip duplicates
            }
        }
        console.log(`   ✅ Migrated ${migrated} messages`);
    } catch (e: any) {
        console.log(`   ⚠️ Messages migration skipped: ${e.message}`);
    }
}

async function migrateTemplateHistory(sqlite: Database.Database, pool: Pool) {
    console.log('📤 Migrating template_history...');

    try {
        const history = sqlite.prepare('SELECT * FROM template_history').all() as any[];
        console.log(`   Found ${history.length} template_history entries`);

        for (const entry of history) {
            await pool.query(`
                INSERT INTO template_history (id, phone, template_name, template_content, sent_at, success, error_message)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
            `, [entry.id, entry.phone, entry.template_name, entry.template_content, entry.sent_at, entry.success === 1, entry.error_message]);
        }

        // Reset sequence
        await pool.query(`SELECT setval('template_history_id_seq', (SELECT COALESCE(MAX(id), 1) FROM template_history))`);
        console.log(`   ✅ Migrated ${history.length} template_history entries`);
    } catch (e: any) {
        console.log(`   ⚠️ Template history migration skipped: ${e.message}`);
    }
}

async function migrateSettings(sqlite: Database.Database, pool: Pool) {
    console.log('📤 Migrating settings...');

    try {
        const settings = sqlite.prepare('SELECT * FROM settings').all() as any[];
        console.log(`   Found ${settings.length} settings`);

        for (const setting of settings) {
            await pool.query(`
                INSERT INTO settings (key, value)
                VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [setting.key, setting.value]);
        }
        console.log(`   ✅ Migrated ${settings.length} settings`);
    } catch (e: any) {
        console.log(`   ⚠️ Settings migration skipped: ${e.message}`);
    }
}

// Run migration
migrate().catch(console.error);
