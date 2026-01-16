/**
 * Seed Test User Script for E2E Tests
 * Creates a test admin user for Playwright E2E tests
 * 
 * Usage: node scripts/seed-test-user.js
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

// Test user credentials (must match e2e/fixtures/auth.ts)
const TEST_USER = {
    name: 'Admin E2E Test',
    email: 'admin@test.e2e',
    password: 'Test@123456',
    role: 'admin'
};

async function seedTestUser() {
    console.log('\n=== Criar Usuário de Teste para E2E ===\n');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL não encontrada no .env.local');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log('⏳ Verificando estrutura do banco de dados...');

        // Ensure users table exists
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

        console.log('✅ Banco de dados pronto\n');

        // Check if test user already exists
        const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [TEST_USER.email]);

        if (existingUser.rows.length > 0) {
            console.log('ℹ️  Usuário de teste já existe');
            console.log(`Email: ${TEST_USER.email}`);
            console.log(`Senha: ${TEST_USER.password}`);
            console.log('\n✅ Pronto para executar testes E2E!');
            await pool.end();
            process.exit(0);
        }

        // Hash password
        console.log('⏳ Criando usuário de teste...');
        const password_hash = await bcrypt.hash(TEST_USER.password, 10);

        // Create test user
        const result = await pool.query(`
            INSERT INTO users (email, password_hash, name, role, active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
            RETURNING *
        `, [TEST_USER.email, password_hash, TEST_USER.name, TEST_USER.role]);

        const user = result.rows[0];

        console.log('\n✅ Usuário de teste criado com sucesso!');
        console.log(`\nID: ${user.id}`);
        console.log(`Nome: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`Senha: ${TEST_USER.password}`);
        console.log(`Role: ${user.role}`);
        console.log('\n✅ Pronto para executar testes E2E!');
        console.log('\nExecute: npm run test:e2e:ui');

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao criar usuário de teste:', error.message);
        await pool.end();
        process.exit(1);
    }
}

seedTestUser();
