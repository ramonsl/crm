/**
 * Migration Script: Populate last_message_time from message_history
 * 
 * Este script atualiza o campo last_message_time na tabela leads
 * com base no histórico de mensagens já enviadas (tabela message_history).
 * 
 * Útil para popular dados históricos após correção do bug onde
 * envios em massa não atualizavam o campo last_message_time.
 * 
 * Uso:
 *   npx tsx scripts/migrate-last-message-time.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configurar WebSocket para Neon
neonConfig.webSocketConstructor = ws;

// Carregar variáveis de ambiente do .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Criar pool de conexão standalone
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateLastMessageTime() {
    console.log('🚀 Iniciando migração de last_message_time...\n');

    try {
        // 1. Verificar quantos leads não têm last_message_time
        const { rows: countRows } = await pool.query(`
            SELECT COUNT(*) as total
            FROM leads l
            WHERE l.last_message_time IS NULL
            AND EXISTS (
                SELECT 1 FROM message_history mh 
                WHERE mh.contact_cpf = l.cpf 
                AND mh.status = 'sent'
            )
        `);

        const totalToUpdate = parseInt(countRows[0].total);
        console.log(`📊 Leads sem last_message_time mas com histórico: ${totalToUpdate}`);

        if (totalToUpdate === 0) {
            console.log('✅ Nenhum lead precisa ser atualizado!');
            return;
        }

        console.log('\n🔄 Atualizando leads...\n');

        // 2. Atualizar last_message e last_message_time com base no histórico mais recente
        const { rowCount } = await pool.query(`
            UPDATE leads l
            SET 
                last_message = mh.message_content,
                last_message_time = mh.sent_at
            FROM (
                SELECT DISTINCT ON (contact_cpf)
                    contact_cpf,
                    message_content,
                    sent_at
                FROM message_history
                WHERE status = 'sent'
                ORDER BY contact_cpf, sent_at DESC
            ) mh
            WHERE l.cpf = mh.contact_cpf
            AND l.last_message_time IS NULL
        `);

        console.log(`✅ ${rowCount} leads atualizados com sucesso!\n`);

        // 3. Mostrar alguns exemplos de leads atualizados
        const { rows: examples } = await pool.query(`
            SELECT 
                nome,
                telefone,
                last_message,
                last_message_time
            FROM leads
            WHERE last_message_time IS NOT NULL
            ORDER BY last_message_time DESC
            LIMIT 5
        `);

        console.log('📋 Exemplos de leads atualizados:');
        console.log('─'.repeat(80));
        examples.forEach((lead: any, index: number) => {
            console.log(`${index + 1}. ${lead.nome} (${lead.telefone})`);
            console.log(`   Última mensagem: ${lead.last_message?.substring(0, 50)}...`);
            console.log(`   Data: ${new Date(lead.last_message_time).toLocaleString('pt-BR')}`);
            console.log('');
        });

        // 4. Estatísticas finais
        const { rows: stats } = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE last_message_time IS NOT NULL) as with_time,
                COUNT(*) FILTER (WHERE last_message_time IS NULL) as without_time,
                COUNT(*) as total
            FROM leads
        `);

        console.log('\n📊 Estatísticas finais:');
        console.log('─'.repeat(80));
        console.log(`Total de leads: ${stats[0].total}`);
        console.log(`Com last_message_time: ${stats[0].with_time} (${Math.round(stats[0].with_time / stats[0].total * 100)}%)`);
        console.log(`Sem last_message_time: ${stats[0].without_time} (${Math.round(stats[0].without_time / stats[0].total * 100)}%)`);

        console.log('\n✅ Migração concluída com sucesso!');

    } catch (error) {
        console.error('❌ Erro durante a migração:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Executar migração
migrateLastMessageTime()
    .then(() => {
        console.log('\n👋 Finalizando...');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Falha na migração:', error);
        process.exit(1);
    });
