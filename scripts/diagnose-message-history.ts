/**
 * Script de Diagnóstico: Verificar estado do histórico de mensagens
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
config({ path: resolve(process.cwd(), '.env.local') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function diagnose() {
    console.log('🔍 Diagnóstico do histórico de mensagens\n');

    try {
        // 1. Total de mensagens no histórico
        const { rows: historyCount } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'sent') as sent,
                COUNT(*) FILTER (WHERE status = 'failed') as failed
            FROM message_history
        `);

        console.log('📊 Histórico de Mensagens:');
        console.log(`   Total: ${historyCount[0].total}`);
        console.log(`   Enviadas: ${historyCount[0].sent}`);
        console.log(`   Falhadas: ${historyCount[0].failed}\n`);

        // 2. Total de leads
        const { rows: leadsCount } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE last_message_time IS NOT NULL) as with_time,
                COUNT(*) FILTER (WHERE last_message_time IS NULL) as without_time
            FROM leads
        `);

        console.log('📊 Leads:');
        console.log(`   Total: ${leadsCount[0].total}`);
        console.log(`   Com last_message_time: ${leadsCount[0].with_time}`);
        console.log(`   Sem last_message_time: ${leadsCount[0].without_time}\n`);

        // 3. Últimas mensagens enviadas
        const { rows: recentMessages } = await pool.query(`
            SELECT 
                mh.contact_cpf,
                l.nome,
                l.telefone,
                mh.template_name,
                mh.sent_at,
                l.last_message_time
            FROM message_history mh
            LEFT JOIN leads l ON l.cpf = mh.contact_cpf
            WHERE mh.status = 'sent'
            ORDER BY mh.sent_at DESC
            LIMIT 10
        `);

        console.log('📋 Últimas 10 mensagens enviadas:');
        console.log('─'.repeat(100));
        recentMessages.forEach((msg: any, index: number) => {
            console.log(`${index + 1}. ${msg.nome || 'Nome não encontrado'} (${msg.telefone || 'Tel não encontrado'})`);
            console.log(`   Template: ${msg.template_name}`);
            console.log(`   Enviado em: ${new Date(msg.sent_at).toLocaleString('pt-BR')}`);
            console.log(`   last_message_time do lead: ${msg.last_message_time ? new Date(msg.last_message_time).toLocaleString('pt-BR') : 'NULL'}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

diagnose()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
