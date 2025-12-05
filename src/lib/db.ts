import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use persistent volume path in production, local path in development
const getDbPath = () => {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }

  if (process.env.NODE_ENV === 'production') {
    const prodPath = '/app/data';
    // Create directory if it doesn't exist
    if (!fs.existsSync(prodPath)) {
      fs.mkdirSync(prodPath, { recursive: true });
    }
    return path.join(prodPath, 'crm.db');
  }

  return path.join(process.cwd(), 'crm.db');
};

const dbPath = getDbPath();
console.log(`[DB] Using database at: ${dbPath}`);
const db = new Database(dbPath);


// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    cpf TEXT PRIMARY KEY,
    nome TEXT,
    email TEXT,
    telefone TEXT,
    tipo_ingresso TEXT,
    status TEXT,
    last_message TEXT,
    unread_count INTEGER DEFAULT 0,
    last_message_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'fixed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Migration: Add columns if they don't exist
try {
  db.exec('ALTER TABLE leads ADD COLUMN last_message TEXT');
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] last_message column already exists');
}
try {
  db.exec('ALTER TABLE leads ADD COLUMN unread_count INTEGER DEFAULT 0');
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] unread_count column already exists');
}
try {
  db.exec('ALTER TABLE leads ADD COLUMN last_message_time DATETIME');
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] last_message_time column already exists');
}
try {
  db.exec('ALTER TABLE leads ADD COLUMN data_inscricao DATETIME');
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] data_inscricao column already exists');
}
try {
  db.exec('ALTER TABLE leads ADD COLUMN notes TEXT');
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] notes column already exists');
}
try {
  db.exec("ALTER TABLE templates ADD COLUMN type TEXT DEFAULT 'fixed'");
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] type column in templates already exists');
}

// Migration: Rename columns in templates table from title/content to name/message
try {
  // Check if old column exists
  const tableInfo = db.prepare("PRAGMA table_info(templates)").all() as any[];
  const hasTitle = tableInfo.some((col: any) => col.name === 'title');
  const hasName = tableInfo.some((col: any) => col.name === 'name');

  if (hasTitle && !hasName) {
    console.log('[DB Migration] Renaming templates columns: title→name, content→message');

    // SQLite doesn't support RENAME COLUMN directly in older versions
    // We need to recreate the table
    db.exec(`
      CREATE TABLE templates_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'fixed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      INSERT INTO templates_new (id, name, message, type, created_at)
      SELECT id, title, content, type, created_at FROM templates;
      
      DROP TABLE templates;
      
      ALTER TABLE templates_new RENAME TO templates;
    `);

    console.log('[DB Migration] Templates table migration completed successfully');
  }
} catch (e) {
  console.error('[DB Migration] Error migrating templates table:', e);
}

// System Notifications Table
db.exec(`
  CREATE TABLE IF NOT EXISTS system_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- info, warning, error, success
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try {
  db.exec('ALTER TABLE leads ADD COLUMN profile_image TEXT');
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] profile_image column already exists');
}
try {
  db.exec('ALTER TABLE leads ADD COLUMN curso_interesse TEXT');
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] curso_interesse column already exists');
}
try {
  db.exec('ALTER TABLE leads ADD COLUMN escola TEXT');
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] escola column already exists');
}

// Import tracking fields
try {
  db.exec('ALTER TABLE leads ADD COLUMN is_new INTEGER DEFAULT 0');
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] is_new column already exists');
}
try {
  db.exec('ALTER TABLE leads ADD COLUMN status_changed INTEGER DEFAULT 0');
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] status_changed column already exists');
}
try {
  db.exec('ALTER TABLE leads ADD COLUMN last_import_date DATETIME');
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] last_import_date column already exists');
}

// Message history tracking
try {
  db.exec('ALTER TABLE leads ADD COLUMN last_template_name TEXT');
} catch (e) {
  // Column already exists, this is expected on subsequent runs
  console.debug('[DB Migration] last_template_name column already exists');
}

// Message History Table
db.exec(`
  CREATE TABLE IF NOT EXISTS message_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_cpf TEXT NOT NULL,
    template_id INTEGER,
    template_name TEXT NOT NULL,
    message_content TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'sent',
    FOREIGN KEY (contact_cpf) REFERENCES leads(cpf) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
  );
`);

// Create indexes for message_history
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_message_history_cpf ON message_history(contact_cpf)');
} catch (e) {
  // Index already exists, this is expected on subsequent runs
  console.debug('[DB Migration] idx_message_history_cpf index already exists');
}
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_message_history_sent_at ON message_history(sent_at DESC)');
} catch (e) {
  // Index already exists, this is expected on subsequent runs
  console.debug('[DB Migration] idx_message_history_sent_at index already exists');
}


// Insert default templates if empty
const templateCount = (db.prepare('SELECT COUNT(*) as count FROM templates').get() as any).count;
if (templateCount === 0) {
  const insert = db.prepare('INSERT INTO templates (name, message, type) VALUES (?, ?, ?)');
  insert.run('Boas-vindas', 'Olá {nome}! Seja bem-vindo ao curso de Análise e Desenvolvimento de Sistemas da ULBRA. Estamos felizes em ter você conosco!', 'fixed');
  insert.run('Ajuda com Matrícula', 'Olá {nome}! Notei que você ainda não finalizou sua matrícula. Precisa de alguma ajuda ou tem alguma dúvida sobre o processo?', 'fixed');
}

export default db;
