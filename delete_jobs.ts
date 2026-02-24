import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { pool } from './src/lib/db';

async function run() {
    try {
        console.log("Checking recent jobs...");
        const res = await pool.query("SELECT * FROM linkedin_jobs ORDER BY created_at DESC LIMIT 10");
        console.log("Found", res.rows.length, "recent jobs.");
        
        // Let's delete the jobs that start with remotar- or vagasremotas- to ensure they can be fetched again
        console.log("Deleting remotar and vagasremotas jobs from today...");
        
        const deleteRes = await pool.query(`
            DELETE FROM linkedin_jobs 
            WHERE linkedin_post_id LIKE 'remotar-%' OR linkedin_post_id LIKE 'vagasremotas-%'
            OR created_at > NOW() - INTERVAL '1 day'
        `);
        console.log("Deleted", deleteRes.rowCount, "jobs. Ready for testing again.");

    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();
