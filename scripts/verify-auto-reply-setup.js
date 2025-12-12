#!/usr/bin/env node

/**
 * Verify Auto-Reply System Setup
 * Checks if database tables exist and are properly configured
 */

const { Pool } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function verifySetup() {
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        console.error('❌ DATABASE_URL not configured in .env.local');
        process.exit(1);
    }

    console.log('🔍 Verificando configuração do sistema de auto-reply...\n');

    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        // Check if tables exist
        const tablesQuery = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('auto_replies', 'auto_reply_logs')
      ORDER BY table_name;
    `);

        console.log('📊 Tabelas encontradas:');
        if (tablesQuery.rows.length === 0) {
            console.log('  ❌ Nenhuma tabela de auto-reply encontrada!');
            console.log('\n💡 Solução: Execute o SQL em migrations/005_create_auto_replies_safe.sql no Neon Dashboard');
            process.exit(1);
        }

        tablesQuery.rows.forEach(row => {
            console.log(`  ✅ ${row.table_name}`);
        });

        // Check for active auto-replies
        const repliesQuery = await pool.query(`
      SELECT id, name, is_active, confidence_threshold
      FROM auto_replies
      ORDER BY priority DESC, id;
    `);

        console.log('\n🤖 Respostas automáticas cadastradas:');
        if (repliesQuery.rows.length === 0) {
            console.log('  ⚠️  Nenhuma resposta automática cadastrada');
            console.log('  💡 Acesse http://localhost:3000/auto-replies para criar');
        } else {
            repliesQuery.rows.forEach(reply => {
                const status = reply.is_active ? '✅ ATIVA' : '⏸️  INATIVA';
                console.log(`  ${status} - ${reply.name} (confiança: ${(reply.confidence_threshold * 100).toFixed(0)}%)`);
            });
        }

        // Check recent logs
        const logsQuery = await pool.query(`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN response_sent IS NOT NULL THEN 1 END) as sent
      FROM auto_reply_logs
      WHERE created_at > NOW() - INTERVAL '24 hours';
    `);

        console.log('\n📈 Atividade nas últimas 24h:');
        const stats = logsQuery.rows[0];
        console.log(`  📝 Total de mensagens analisadas: ${stats.total}`);
        console.log(`  ✉️  Respostas enviadas: ${stats.sent}`);

        // Check OpenAI key
        const hasOpenAI = !!process.env.OPENAI_API_KEY;
        console.log('\n🔑 OpenAI API Key:');
        console.log(hasOpenAI ? '  ✅ Configurada' : '  ❌ Não configurada');

        console.log('\n✅ Verificação completa!');

    } catch (error) {
        console.error('\n❌ Erro na verificação:');
        console.error(error.message);

        if (error.message.includes('relation') && error.message.includes('does not exist')) {
            console.log('\n💡 As tabelas não existem. Execute:');
            console.log('   migrations/005_create_auto_replies_safe.sql no Neon Dashboard');
        }

        process.exit(1);
    } finally {
        await pool.end();
    }
}

verifySetup();
