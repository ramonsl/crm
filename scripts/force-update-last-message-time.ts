/**
 * Migration Script: Force update last_message_time from message_history
 * 
 * Este script FORÇA a atualização do campo last_message_time na tabela leads
 * com base no histórico de mensagens, MESMO que já exista um valor.
 * 
 * Útil para corrigir dados históricos onde last_message_time pode estar
 * desatualizado ou incorreto.
 * 
 * Uso:
 *   npx tsx scripts/force-update-last-message-time.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
config({ path: resolve(process.cwd(), '.env.local') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function forceUpdateLastMessageTime() {
    console.log('🚀 Iniciando ATUALIZAÇÃO FORÇADA de last_message_time...\n');
    console.log('⚠️  Este script irá SOBRESCREVER valores existentes!\n');

    try {
        // 1. Verificar quantos leads têm histórico
        const { rows: countRows } = await pool.query(`
            SELECT COUNT(DISTINCT contact_cpf) as total
            FROM message_history
            WHERE status = 'sent'
        `);

        const totalWithHistory = parseInt(countRows[0].total);
        console.log(`📊 Leads com histórico de envios: ${totalWithHistory}\n`);

        if (totalWithHistory === 0) {
            console.log('✅ Nenhum lead com histórico encontrado!');
            return;
        }

        console.log('🔄 Atualizando TODOS os leads com histórico...\n');

        // 2. FORÇAR atualização de last_message e last_message_time
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
        `);

        console.log(`✅ ${rowCount} leads atualizados com sucesso!\n`);

        // 3. Mostrar alguns exemplos
        const { rows: examples } = await pool.query(`
            SELECT 
                nome,
                telefone,
                last_message,
                last_message_time
            FROM leads
            WHERE last_message_time IS NOT NULL
            ORDER BY last_message_time DESC
            LIMIT 10
        `);

        console.log('📋 Últimos 10 leads atualizados:');
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

        console.log('\n✅ Atualização forçada concluída com sucesso!');

    } catch (error) {
        console.error('❌ Erro durante a migração:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

forceUpdateLastMessageTime()
    .then(() => {
        console.log('\n👋 Finalizando...');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Falha na migração:', error);
        process.exit(1);
    });
