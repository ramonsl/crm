import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'crm.db');
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
    title TEXT NOT NULL,
    content TEXT NOT NULL,
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
} catch (e) { }
try {
  db.exec('ALTER TABLE leads ADD COLUMN unread_count INTEGER DEFAULT 0');
} catch (e) { }
try {
  db.exec('ALTER TABLE leads ADD COLUMN last_message_time DATETIME');
} catch (e) { }
try {
  db.exec('ALTER TABLE leads ADD COLUMN data_inscricao DATETIME');
} catch (e) { }
try {
  db.exec('ALTER TABLE leads ADD COLUMN notes TEXT');
} catch (e) { }
try {
  db.exec("ALTER TABLE templates ADD COLUMN type TEXT DEFAULT 'fixed'");
} catch (e) { }

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
} catch (e) { }
try {
  db.exec('ALTER TABLE leads ADD COLUMN curso_interesse TEXT');
} catch (e) { }
try {
  db.exec('ALTER TABLE leads ADD COLUMN escola TEXT');
} catch (e) { }

// Insert default templates if empty
const templateCount = (db.prepare('SELECT COUNT(*) as count FROM templates').get() as any).count;
if (templateCount === 0) {
  const insert = db.prepare('INSERT INTO templates (title, content, type) VALUES (?, ?, ?)');
  insert.run('Boas-vindas', 'Olá {nome}! Seja bem-vindo ao curso de Análise e Desenvolvimento de Sistemas da ULBRA. Estamos felizes em ter você conosco!', 'fixed');
  insert.run('Ajuda com Matrícula', 'Olá {nome}! Notei que você ainda não finalizou sua matrícula. Precisa de alguma ajuda ou tem alguma dúvida sobre o processo?', 'fixed');
}

export default db;
