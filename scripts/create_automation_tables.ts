/**
 * Script para criar tabelas de automação em produção
 * Uso: DATABASE_URL="..." npx ts-node scripts/create_automation_tables.ts
 */

import { Pool } from 'pg';

async function createAutomationTables() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    console.log('🔄 Criando tabelas de automação em produção...\n');

    try {
        // Verificar se as tabelas já existem
        const check = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('status_templates', 'status_message_log')
        `);

        console.log('Tabelas existentes:', check.rows.map(r => r.table_name));

        // Criar status_templates se não existir
        console.log('\n📋 Criando status_templates...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS status_templates (
                id SERIAL PRIMARY KEY,
                status_name TEXT NOT NULL UNIQUE,
                template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        console.log('✅ status_templates criada');

        // Criar índice
        await pool.query(`
            CREATE INDEX IF NOT EXISTS status_templates_status_name_idx 
            ON status_templates(status_name)
        `);
        console.log('✅ Índice criado');

        // Criar status_message_log se não existir
        console.log('\n📋 Criando status_message_log...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS status_message_log (
                id SERIAL PRIMARY KEY,
                contact_cpf TEXT NOT NULL REFERENCES leads(cpf) ON DELETE CASCADE,
                status_name TEXT NOT NULL,
                template_id INTEGER,
                message_id TEXT,
                sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT unique_cpf_status UNIQUE (contact_cpf, status_name)
            )
        `);
        console.log('✅ status_message_log criada');

        // Criar índices
        await pool.query(`
            CREATE INDEX IF NOT EXISTS status_message_log_contact_cpf_idx 
            ON status_message_log(contact_cpf)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS status_message_log_status_name_idx 
            ON status_message_log(status_name)
        `);
        console.log('✅ Índices criados');

        // Registrar na tabela de migrações (se existir)
        try {
            await pool.query(`
                INSERT INTO pgmigrations (name, run_on) 
                VALUES ('1766168307262_create-status-templates', NOW())
                ON CONFLICT DO NOTHING
            `);
            await pool.query(`
                INSERT INTO pgmigrations (name, run_on) 
                VALUES ('1766168351731_create-status-message-log', NOW())
                ON CONFLICT DO NOTHING
            `);
            console.log('\n✅ Migrações registradas em pgmigrations');
        } catch (e) {
            console.log('\n⚠️ pgmigrations não existe, ignorando registro');
        }

        console.log('\n✅ Tabelas de automação criadas com sucesso!');

    } catch (error) {
        console.error('❌ Erro:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

createAutomationTables();
