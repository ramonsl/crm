
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkCourses() {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`
        SELECT DISTINCT curso_interesse 
        FROM leads 
        WHERE curso_interesse IS NOT NULL AND curso_interesse != ''
        ORDER BY curso_interesse
    `;
    console.log('Available courses:', result.map(r => r.curso_interesse));
}

checkCourses();
