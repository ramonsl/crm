/**
 * Script para analisar casos de duplicação de status
 * Roda com: DATABASE_URL=<prod_url> npx tsx scripts/analyze_duplicate_status.ts
 */

import { neon } from '@neondatabase/serverless';

async function analyzeDuplicateStatus() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ DATABASE_URL not found. Run with:');
        console.error('DATABASE_URL=<your_prod_url> npx tsx scripts/analyze_duplicate_status.ts');
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    console.log('🔍 Analisando casos de duplicação de status...\n');

    // 1. Buscar informações dos leads específicos
    const leads = await sql`
        SELECT cpf, nome, status, status_changed_at, updated_at, created_at
        FROM leads
        WHERE nome ILIKE '%Gabriel Martins Tieze%' 
           OR nome ILIKE '%Nátany Oliveira%'
           OR nome ILIKE '%Natany Oliveira%'
        ORDER BY nome
    `;

    console.log('📋 LEADS ENCONTRADOS:');
    console.log('='.repeat(80));

    for (const lead of leads) {
        console.log(`\nNome: ${lead.nome}`);
        console.log(`CPF: ${lead.cpf}`);
        console.log(`Status atual: ${lead.status}`);
        console.log(`Status alterado em: ${lead.status_changed_at}`);
        console.log(`Atualizado em: ${lead.updated_at}`);
        console.log(`Criado em: ${lead.created_at}`);
        console.log('-'.repeat(40));

        // 2. Buscar histórico de atividades (mudanças de status)
        const activities = await sql`
            SELECT type, description, created_at, metadata
            FROM activities
            WHERE contact_cpf = ${lead.cpf}
            ORDER BY created_at DESC
            LIMIT 20
        `;

        console.log(`\n📜 HISTÓRICO DE ATIVIDADES (${activities.length} registros):`);
        for (const act of activities) {
            console.log(`  [${act.created_at}] ${act.type}: ${act.description}`);
            if (act.metadata) {
                console.log(`    Metadata: ${JSON.stringify(act.metadata)}`);
            }
        }

        // 3. Buscar histórico de mensagens enviadas
        const messages = await sql`
            SELECT template_name, message_content, sent_at, status
            FROM message_history
            WHERE contact_cpf = ${lead.cpf}
            ORDER BY sent_at DESC
            LIMIT 10
        `;

        console.log(`\n💬 HISTÓRICO DE MENSAGENS (${messages.length} registros):`);
        for (const msg of messages) {
            console.log(`  [${msg.sent_at}] ${msg.template_name} - Status: ${msg.status}`);
        }

        // 4. Buscar histórico de template_history (whatsapp)
        const templateHistory = await sql`
            SELECT template_name, sent_at, success, error_message
            FROM template_history
            WHERE phone LIKE '%' || RIGHT(${lead.cpf}, 8) || '%'
            ORDER BY sent_at DESC
            LIMIT 10
        `;

        console.log(`\n📤 TEMPLATE HISTORY (WhatsApp - ${templateHistory.length} registros):`);
        for (const th of templateHistory) {
            console.log(`  [${th.sent_at}] ${th.template_name} - Success: ${th.success}`);
            if (th.error_message) {
                console.log(`    Erro: ${th.error_message}`);
            }
        }

        console.log('\n' + '='.repeat(80));
    }

    // 5. Análise geral: Quantos leads têm múltiplas mudanças para o mesmo status?
    console.log('\n\n📊 ANÁLISE GERAL DE DUPLICAÇÕES:');
    console.log('='.repeat(80));

    const duplicateStatusChanges = await sql`
        SELECT 
            contact_cpf,
            description,
            COUNT(*) as count
        FROM activities
        WHERE type = 'status_change'
        GROUP BY contact_cpf, description
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 20
    `;

    console.log(`\nLeads com múltiplas mudanças para o MESMO status:`);
    for (const dup of duplicateStatusChanges) {
        const leadInfo = await sql`SELECT nome FROM leads WHERE cpf = ${dup.contact_cpf} LIMIT 1`;
        const nome = leadInfo[0]?.nome || 'Desconhecido';
        console.log(`  ${nome}: "${dup.description}" - ${dup.count}x`);
    }

    // 6. Verificar se há CPFs duplicados
    console.log('\n\n🔄 VERIFICANDO DUPLICAÇÕES DE CPF/TELEFONE:');

    const duplicatePhones = await sql`
        SELECT telefone, COUNT(*) as count, array_agg(nome) as nomes
        FROM leads
        GROUP BY telefone
        HAVING COUNT(*) > 1
        LIMIT 10
    `;

    if (duplicatePhones.length > 0) {
        console.log('Telefones duplicados encontrados:');
        for (const dup of duplicatePhones) {
            console.log(`  ${dup.telefone}: ${dup.count}x - ${dup.nomes.join(', ')}`);
        }
    } else {
        console.log('Nenhum telefone duplicado encontrado.');
    }

    console.log('\n✅ Análise concluída!');
}

analyzeDuplicateStatus().catch(console.error);
