import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });

async function checkCourses() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not defined');
    }

    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`
        SELECT DISTINCT curso_interesse 
        FROM leads 
        WHERE curso_interesse IS NOT NULL AND curso_interesse != ''
        ORDER BY curso_interesse
    `;
    console.log('Available courses:', result.map((r: { curso_interesse: string }) => r.curso_interesse));
}

checkCourses().catch(console.error);
