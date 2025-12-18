/**
 * Database Initialization and Schema
 * 
 * PostgreSQL schema definitions and migrations for the CRM.
 * Uses Neon's serverless PostgreSQL driver.
 */

import { pool, transaction, query, queryOne, execute, sql } from './neonDb';

// Re-export all database functions for backwards compatibility
export { pool, transaction, query, queryOne, execute, sql };

/**
 * Initialize database schema
 * ⚠️ WARNING: Use this ONLY for local development or initial setup.
 * For production and managed schema changes, use the Migrations system:
 * 
 * - Create migration: npm run migrate:create -- name
 * - Run migrations: npm run migrate:test (local) or npm run migrate:prod (production)
 */
export async function initializeDatabase(): Promise<void> {
  console.log('[DB] ⚠️  WARNING: Using legacy initializeDatabase().');
  console.log('[DB] Consider using "npm run migrate:test" for managed migrations.');
  console.log('[DB] Initializing PostgreSQL schema...');

  try {
    // Create leads table
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
        status_changed_at TIMESTAMP,
        last_import_date TIMESTAMP,
        last_template_name TEXT,
        whatsapp_valido INTEGER DEFAULT 0,
        profile_picture TEXT,
        last_template_sent TEXT,
        last_template_sent_at TIMESTAMP
      )
    `);
    console.log('[DB] ✅ Table: leads');

    // Create templates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'fixed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[DB] ✅ Table: templates');

    // Create settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    console.log('[DB] ✅ Table: settings');

    // Create system_notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_notifications (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[DB] ✅ Table: system_notifications');

    // Create message_history table
    await pool.query(`
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
    `);
    console.log('[DB] ✅ Table: message_history');

    // Create template_history table
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
    console.log('[DB] ✅ Table: template_history');

    // Create statuses table
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
    console.log('[DB] ✅ Table: statuses');

    // Create users table
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
    console.log('[DB] ✅ Table: users');

    // Create sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('[DB] ✅ Table: sessions');

    // Create activities table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        contact_cpf TEXT NOT NULL,
        type TEXT NOT NULL,
        subtype TEXT,
        title TEXT NOT NULL,
        description TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_activity_contact FOREIGN KEY (contact_cpf) REFERENCES leads(cpf) ON DELETE CASCADE
      )
    `);
    console.log('[DB] ✅ Table: activities');

    // Create messages table for WhatsApp chat history
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
    console.log('[DB] ✅ Table: messages');

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
    console.log('[DB] ✅ Table: tags');

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
    console.log('[DB] ✅ Table: lead_tags');

    // Create indexes
    await createIndexes();

    // Seed default data
    await seedDefaultData();

    console.log('[DB] ✅ PostgreSQL schema initialized successfully');

  } catch (error) {
    console.error('[DB] ❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Create indexes for better query performance
 */
async function createIndexes(): Promise<void> {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_message_history_cpf ON message_history(contact_cpf)',
    'CREATE INDEX IF NOT EXISTS idx_message_history_sent_at ON message_history(sent_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_template_history_phone ON template_history(phone)',
    'CREATE INDEX IF NOT EXISTS idx_template_history_sent_at ON template_history(sent_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_template_history_phone_sent_at ON template_history(phone, sent_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_cpf, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type)',
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_active ON users(active)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(contact_phone)',
    'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)',
  ];

  for (const indexQuery of indexes) {
    try {
      await pool.query(indexQuery);
    } catch (e) {
      // Index might already exist, ignore
    }
  }
  console.log('[DB] ✅ Indexes created');
}

/**
 * Seed default data if tables are empty
 */
async function seedDefaultData(): Promise<void> {
  // Seed default templates
  const templateCount = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM templates');
  if (templateCount && parseInt(templateCount.count) === 0) {
    await pool.query(`
      INSERT INTO templates (name, message, type) VALUES 
      ($1, $2, $3),
      ($4, $5, $6)
    `, [
      'Boas-vindas',
      'Olá {nome}! Seja bem-vindo ao curso de Análise e Desenvolvimento de Sistemas da ULBRA. Estamos felizes em ter você conosco!',
      'fixed',
      'Ajuda com Matrícula',
      'Olá {nome}! Notei que você ainda não finalizou sua matrícula. Precisa de alguma ajuda ou tem alguma dúvida sobre o processo?',
      'fixed'
    ]);
    console.log('[DB] ✅ Default templates seeded');
  }

  // Seed default statuses
  const statusCount = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM statuses');
  if (statusCount && parseInt(statusCount.count) === 0) {
    const defaultStatuses = [
      { name: 'Novo', color: '#3b82f6' },
      { name: 'Leads', color: '#8b5cf6' },
      { name: 'Inscrito Confirmado', color: '#06b6d4' },
      { name: 'Aprovado', color: '#22c55e' },
      { name: 'Reprovado', color: '#ef4444' },
      { name: 'Pagamento da Matrícula Iniciado', color: '#f97316' },
      { name: 'Matrícula Confirmada', color: '#10b981' },
      { name: 'Desistente', color: '#6b7280' },
    ];

    for (let i = 0; i < defaultStatuses.length; i++) {
      await pool.query(
        'INSERT INTO statuses (name, color, display_order, active) VALUES ($1, $2, $3, 1)',
        [defaultStatuses[i].name, defaultStatuses[i].color, i]
      );
    }
    console.log('[DB] ✅ Default statuses seeded');
  }
}

/**
 * Check if database is connected and tables exist
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('[DB] Connection check failed:', error);
    return false;
  }
}

// Export default for backward compatibility
// Components that import 'db' will need to be updated to use async queries
const db = {
  query,
  queryOne,
  execute,
  transaction,
  pool,
  sql,
};

export default db;
