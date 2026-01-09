
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fixLeads() {
    const sql = neon(process.env.DATABASE_URL);

    // Check count before
    const countBefore = await sql`SELECT count(*) FROM leads WHERE curso_interesse = 'POS'`;
    console.log(`Leads with POS: ${countBefore[0].count}`);

    // Update tipo_ingresso to '2026/1' for these leads
    // The user said "semestre 2026/1", so we set tipo_ingresso to that.
    // The filter logic regex matches '2026/1', so it should work.

    const result = await sql`
        UPDATE leads 
        SET tipo_ingresso = '2026/1' 
        WHERE curso_interesse = 'POS'
    `;

    console.log(`Updated ${result.rowCount} leads.`);
}

fixLeads();
