/**
 * Fix duplicate status: Matricula Confirmada -> Matrícula Confirmada
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fixMatriculaStatus() {
    const sql = neon(process.env.DATABASE_URL);

    console.log('🔍 Checking for leads with "Matricula Confirmada" (sem acento)...\n');

    // Count leads with wrong status
    const count = await sql`
        SELECT COUNT(*) as total 
        FROM leads 
        WHERE status = 'Matricula Confirmada'
    `;

    console.log(`Found ${count[0].total} leads with "Matricula Confirmada"`);

    if (count[0].total > 0) {
        console.log('\n🔄 Updating to "Matrícula Confirmada" (com acento)...');

        await sql`
            UPDATE leads 
            SET status = 'Matrícula Confirmada' 
            WHERE status = 'Matricula Confirmada'
        `;

        console.log('✅ Updated successfully!');
    } else {
        console.log('✅ No leads to update');
    }

    // Verify
    console.log('\n📊 Current status distribution:');
    const statuses = await sql`
        SELECT status, COUNT(*) as count 
        FROM leads 
        WHERE status LIKE '%atricula%'
        GROUP BY status
        ORDER BY status
    `;

    statuses.forEach(s => {
        console.log(`  - "${s.status}": ${s.count} leads`);
    });
}

fixMatriculaStatus()
    .then(() => console.log('\n🎉 Done!'))
    .catch(err => console.error('❌ Error:', err));
