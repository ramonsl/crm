import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { Pool } from 'pg';

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        const deleteRes = await pool.query(`
            DELETE FROM linkedin_jobs 
            WHERE linkedin_post_id LIKE 'remotar-%' OR linkedin_post_id LIKE 'vagasremotas-%'
            OR created_at > NOW() - INTERVAL '1 day'
        `);
        console.log("Deleted", deleteRes.rowCount, "jobs.");
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
