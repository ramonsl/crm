
import { pool } from '../src/lib/db';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function diagnoseContact(term: string) {
    console.log(`🔍 Diagnosing contact: "${term}"\n`);

    try {
        // 1. Find Leads
        console.log('--- LEADS ---');
        const leads = await pool.query(`
            SELECT cpf, nome, telefone, created_at 
            FROM leads 
            WHERE nome ILIKE $1 OR cpf = $2 OR telefone ILIKE $2
        `, [`%${term}%`, term]);

        if (leads.rows.length === 0) {
            console.log('❌ No leads found.');
            return;
        }

        for (const lead of leads.rows) {
            console.log(`\n👤 FOUND LEAD: ${lead.nome} (CPF: ${lead.cpf})`);
            console.log(`   Phone: ${lead.telefone}`);
            console.log(`   Created: ${lead.created_at}`);

            // 2. Check Activities
            const activities = await pool.query(`
                SELECT count(*) as count, max(created_at) as last_activity
                FROM activities 
                WHERE contact_cpf = $1
            `, [lead.cpf]);
            console.log(`   📊 Activities: ${activities.rows[0].count} records (Last: ${activities.rows[0].last_activity})`);

            // 3. Check Message History (Legacy)
            const history = await pool.query(`
                SELECT count(*) as count, max(sent_at) as last_sent
                FROM message_history 
                WHERE contact_cpf = $1
            `, [lead.cpf]);
            console.log(`   📜 Message History (Legacy): ${history.rows[0].count} records (Last: ${history.rows[0].last_sent})`);

            // 4. Check Messages (Chat) - Check Exact and Cleaned
            const phoneClean = lead.telefone.replace(/\D/g, '');
            const phone55 = `55${phoneClean}`;

            const messages = await pool.query(`
                SELECT count(*) as count, max(timestamp) as last_msg
                FROM messages 
                WHERE contact_phone IN ($1, $2, $3)
            `, [lead.telefone, phoneClean, phone55]);
            console.log(`   💬 Messages (Chat): ${messages.rows[0].count} records (Last: ${messages.rows[0].last_msg})`);

            // Check specifically for migrated messages
            const migrated = await pool.query(`
                SELECT count(*) as count
                FROM messages 
                WHERE contact_phone IN ($1, $2, $3) AND provider = 'system_migration'
            `, [lead.telefone, phoneClean, phone55]);
            console.log(`      ↳ Migrated: ${migrated.rows[0].count}`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (require.main === module) {
            await pool.end();
        }
    }
}

// Get arg
const arg = process.argv[2];
if (arg) {
    diagnoseContact(arg);
} else {
    console.log('Usage: npx tsx scripts/diagnose-contact.ts <Name_or_CPF>');
}
