/**
 * Migration Script: Populate messages table from message_history
 * 
 * Este script popula a tabela messages com dados históricos de message_history
 * para que mensagens enviadas em massa apareçam na Timeline de Atividades.
 * 
 * Uso:
 *   npx tsx scripts/migrate-messages-from-history.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
config({ path: resolve(process.cwd(), '.env.local') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateMessagesFromHistory() {
    console.log('🚀 Iniciando migração de message_history para messages...\n');

    try {
        // 1. Verificar quantas mensagens já existem
        const { rows: existingCount } = await pool.query(`
            SELECT COUNT(*) as total FROM messages
        `);
        console.log(`📊 Mensagens existentes na tabela messages: ${existingCount[0].total}\n`);

        // 2. Verificar quantas mensagens temos no histórico
        const { rows: historyCount } = await pool.query(`
            SELECT COUNT(*) as total 
            FROM message_history 
            WHERE status = 'sent'
        `);
        console.log(`📊 Mensagens no histórico (message_history): ${historyCount[0].total}\n`);

        if (parseInt(historyCount[0].total) === 0) {
            console.log('✅ Nenhuma mensagem no histórico para migrar!');
            return;
        }

        console.log('🔄 Migrando mensagens do histórico...\n');

        // 3. Inserir mensagens do histórico na tabela messages
        // Usamos o ID do message_history como parte do ID único
        const { rowCount } = await pool.query(`
            INSERT INTO messages (id, contact_phone, content, from_me, timestamp, type)
            SELECT 
                'history_' || mh.id::text || '_' || EXTRACT(EPOCH FROM mh.sent_at)::bigint::text as id,
                l.telefone as contact_phone,
                mh.message_content as content,
                true as from_me,
                mh.sent_at as timestamp,
                'text' as type
            FROM message_history mh
            INNER JOIN leads l ON l.cpf = mh.contact_cpf
            WHERE mh.status = 'sent'
            AND l.telefone IS NOT NULL
            ON CONFLICT (id) DO NOTHING
        `);

        console.log(`✅ ${rowCount} mensagens migradas com sucesso!\n`);

        // 4. Mostrar estatísticas finais
        const { rows: finalCount } = await pool.query(`
            SELECT COUNT(*) as total FROM messages
        `);

        console.log('📊 Estatísticas finais:');
        console.log('─'.repeat(80));
        console.log(`Total de mensagens na tabela messages: ${finalCount[0].total}`);
        console.log(`Mensagens adicionadas nesta migração: ${rowCount}`);

        // 5. Mostrar alguns exemplos
        const { rows: examples } = await pool.query(`
            SELECT 
                m.id,
                m.contact_phone,
                m.content,
                m.timestamp
            FROM messages m
            WHERE m.id LIKE 'history_%'
            ORDER BY m.timestamp DESC
            LIMIT 5
        `);

        console.log('\n📋 Exemplos de mensagens migradas:');
        console.log('─'.repeat(80));
        examples.forEach((msg: any, index: number) => {
            console.log(`${index + 1}. ${msg.contact_phone}`);
            console.log(`   Conteúdo: ${msg.content.substring(0, 50)}...`);
            console.log(`   Data: ${new Date(msg.timestamp).toLocaleString('pt-BR')}`);
            console.log('');
        });

        console.log('\n✅ Migração concluída com sucesso!');
        console.log('📱 Mensagens históricas agora aparecerão na Timeline de Atividades!');

    } catch (error) {
        console.error('❌ Erro durante a migração:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

migrateMessagesFromHistory()
    .then(() => {
        console.log('\n👋 Finalizando...');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Falha na migração:', error);
        process.exit(1);
    });
