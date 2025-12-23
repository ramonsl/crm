import { pool } from '../src/lib/db';

async function verifyStatusAutomation() {
    console.log('\n=== VERIFICAÇÃO DA AUTOMAÇÃO DE STATUS ===\n');

    try {
        // 1. Check status_templates configuration
        console.log('📋 Templates configurados por status:\n');
        const templatesResult = await pool.query(`
            SELECT 
                st.id,
                st.status_name,
                st.template_id,
                st.is_active,
                t.name as template_name,
                st.created_at
            FROM status_templates st
            LEFT JOIN templates t ON t.id = st.template_id
            ORDER BY st.created_at DESC
        `);

        if (templatesResult.rows.length === 0) {
            console.log('❌ PROBLEMA: Nenhum template configurado!');
            console.log('   Para configurar, você precisa inserir registros na tabela status_templates\n');
        } else {
            templatesResult.rows.forEach(row => {
                const activeIcon = row.is_active ? '✅' : '⚠️ INATIVO';
                console.log(`${activeIcon} Status: "${row.status_name}"`);
                console.log(`   Template: ${row.template_name || 'N/A'} (ID: ${row.template_id || 'N/A'})`);
                console.log(`   Criado em: ${row.created_at}\n`);
            });
        }

        // 2. Check recent status change logs
        console.log('\n📨 Histórico de mensagens enviadas (últimas 10):\n');
        const logsResult = await pool.query(`
            SELECT 
                sml.contact_cpf,
                sml.status_name,
                sml.template_id,
                sml.sent_at,
                l.nome as lead_name
            FROM status_message_log sml
            LEFT JOIN leads l ON l.cpf = sml.contact_cpf
            ORDER BY sml.sent_at DESC
            LIMIT 10
        `);

        if (logsResult.rows.length === 0) {
            console.log('ℹ️  Nenhuma mensagem foi enviada ainda via automação de status\n');
        } else {
            logsResult.rows.forEach(row => {
                console.log(`📧 ${row.lead_name || row.contact_cpf}`);
                console.log(`   Status: "${row.status_name}"`);
                console.log(`   Template ID: ${row.template_id}`);
                console.log(`   Enviado em: ${row.sent_at}\n`);
            });
        }

        // 3. Check available templates
        console.log('\n📝 Templates disponíveis no sistema:\n');
        const allTemplatesResult = await pool.query(`
            SELECT id, name, created_at
            FROM templates
            ORDER BY created_at DESC
            LIMIT 10
        `);

        if (allTemplatesResult.rows.length === 0) {
            console.log('❌ PROBLEMA: Nenhum template cadastrado no sistema!\n');
        } else {
            allTemplatesResult.rows.forEach(row => {
                console.log(`📄 ${row.name} (ID: ${row.id})`);
            });
        }

        // 4. Test scenario simulation
        console.log('\n\n🧪 SIMULAÇÃO DE TESTE:\n');
        console.log('Para testar a automação:');
        console.log('1. Certifique-se de ter um template cadastrado');
        console.log('2. Configure uma regra em status_templates (ex: status="APROVADO", template_id=X, is_active=true)');
        console.log('3. Edite um lead e mude seu status para "APROVADO"');
        console.log('4. Verifique os logs do servidor para ver:');
        console.log('   - "Message queued for CPF ... on status change to ..."');
        console.log('5. Verifique a tabela status_message_log para confirmar o registro\n');

    } catch (error) {
        console.error('❌ Erro ao verificar automação:', error);
    } finally {
        await pool.end();
    }
}

verifyStatusAutomation();
