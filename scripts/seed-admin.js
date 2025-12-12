/**
 * Seed Admin User Script (CommonJS version)
 * Creates the first admin user for the system
 * 
 * Usage: node scripts/seed-admin.js
 */

const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
}

async function seedAdmin() {
    console.log('\n=== Criar Primeiro Usuário Admin ===\n');

    try {
        // Connect to database
        const dbPath = path.join(process.cwd(), 'crm.db');
        const db = new Database(dbPath);

        // Run migrations to ensure tables exist
        console.log('⏳ Verificando estrutura do banco de dados...');

        // Create users table
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes
        db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_users_active ON users(active)`);

        // Create sessions table
        db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create session indexes
        db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);

        console.log('✅ Banco de dados pronto\n');

        // Get user input
        const name = await question('Nome: ');
        const email = await question('Email: ');
        const password = await question('Senha (mínimo 6 caracteres): ');

        // Validate input
        if (!name || !email || !password) {
            console.error('\n❌ Todos os campos são obrigatórios');
            rl.close();
            db.close();
            process.exit(1);
        }

        if (password.length < 6) {
            console.error('\n❌ A senha deve ter no mínimo 6 caracteres');
            rl.close();
            db.close();
            process.exit(1);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.error('\n❌ Email inválido');
            rl.close();
            db.close();
            process.exit(1);
        }

        // Check if email already exists
        const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (existingUser) {
            console.error('\n❌ Email já cadastrado');
            rl.close();
            db.close();
            process.exit(1);
        }

        // Hash password
        console.log('\n⏳ Criando usuário admin...');
        const password_hash = await bcrypt.hash(password, 10);

        // Create user
        const stmt = db.prepare(`
            INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
            VALUES (?, ?, ?, 'admin', datetime('now'), datetime('now'))
        `);

        const result = stmt.run(email, password_hash, name);
        const userId = result.lastInsertRowid;

        // Get created user
        const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(userId);

        console.log('\n✅ Usuário admin criado com sucesso!');
        console.log(`\nID: ${user.id}`);
        console.log(`Nome: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`Role: ${user.role}`);
        console.log(`\nVocê já pode fazer login no sistema em http://localhost:3001/login`);

        rl.close();
        db.close();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao criar usuário:', error.message);
        rl.close();
        process.exit(1);
    }
}

seedAdmin();
