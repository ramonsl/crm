/**
 * Seed Admin User Script (Neon PostgreSQL version)
 * Creates the first admin user for the system
 * 
 * Usage: node scripts/seed-admin-neon.js
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const readline = require('readline');

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
    console.log('\n=== Criar Primeiro Usuário Admin (Neon DB) ===\n');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL não encontrada no .env.local');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        // Run migrations to ensure tables exist
        console.log('⏳ Verificando estrutura do banco de dados...');

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

        // Create indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_active ON users(active)`);

        // Create sessions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create session indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);

        console.log('✅ Banco de dados pronto\n');

        // Get user input
        const name = await question('Nome: ');
        const email = await question('Email: ');
        const password = await question('Senha (mínimo 6 caracteres): ');

        // Validate input
        if (!name || !email || !password) {
            console.error('\n❌ Todos os campos são obrigatórios');
            rl.close();
            await pool.end();
            process.exit(1);
        }

        if (password.length < 6) {
            console.error('\n❌ A senha deve ter no mínimo 6 caracteres');
            rl.close();
            await pool.end();
            process.exit(1);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.error('\n❌ Email inválido');
            rl.close();
            await pool.end();
            process.exit(1);
        }

        // Check if email already exists
        const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            console.error('\n❌ Email já cadastrado');
            rl.close();
            await pool.end();
            process.exit(1);
        }

        // Hash password
        console.log('\n⏳ Criando usuário admin...');
        const password_hash = await bcrypt.hash(password, 10);

        // Create user
        const result = await pool.query(`
            INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
            VALUES ($1, $2, $3, 'admin', NOW(), NOW())
            RETURNING *
        `, [email, password_hash, name]);

        const user = result.rows[0];

        console.log('\n✅ Usuário admin criado com sucesso!');
        console.log(`\nID: ${user.id}`);
        console.log(`Nome: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`Role: ${user.role}`);
        console.log(`\nVocê já pode fazer login no sistema em http://localhost:3000/login`);

        rl.close();
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao criar usuário:', error.message);
        rl.close();
        await pool.end();
        process.exit(1);
    }
}

seedAdmin();
