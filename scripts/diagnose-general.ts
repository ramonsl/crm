
import { pool } from '../src/lib/db';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function diagnoseGeneral() {
    console.log('🔍 Starting General Data Diagnosis...\n');

    try {
        // 1. Total Leads
        const totalLeads = await pool.query('SELECT COUNT(*) FROM leads');
        console.log(`📉 Total Leads: ${totalLeads.rows[0].count}`);

        // 2. Suspicious Leads (CPF/Phone appearing to be IDs)
        const suspicious = await pool.query(`
            SELECT COUNT(*) 
            FROM leads 
            WHERE cpf LIKE '%@%' OR telefone LIKE '%@%' OR LENGTH(cpf) > 15
        `);
        console.log(`👻 Suspicious Leads (containing '@' or long CPF): ${suspicious.rows[0].count}`);

        // 3. Leads with NO Activities
        const noActivities = await pool.query(`
            SELECT COUNT(*) 
            FROM leads l
            LEFT JOIN activities a ON a.contact_cpf = l.cpf
            WHERE a.id IS NULL
        `);
        console.log(`📭 Leads with ZERO Activities: ${noActivities.rows[0].count}`);

        // 4. Leads with NO Messages (but valid-ish phone)
        // This is harder because of the join condition on clean phone, but let's try a simple check
        // We'll verify how many leads don't match ANY message
        const sampleCheck = await pool.query(`
            SELECT l.nome, l.telefone, l.cpf
            FROM leads l
            WHERE l.telefone ~ '^[0-9]+$' AND LENGTH(l.telefone) >= 10
            AND NOT EXISTS (
                 SELECT 1 FROM messages m WHERE m.contact_phone LIKE '%' || l.telefone || '%'
            )
            AND NOT EXISTS (
                 SELECT 1 FROM message_history mh WHERE mh.contact_cpf = l.cpf
            )
            LIMIT 5
        `);

        console.log(`\n🧪 Sample Valid Leads with NO Messages or History (Potential Timeline Bug):`);
        sampleCheck.rows.forEach(r => {
            console.log(`   - ${r.nome} (Tel: ${r.telefone}, CPF: ${r.cpf})`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (require.main === module) {
            await pool.end();
        }
    }
}

diagnoseGeneral();
