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
        const res = await pool.query(`
            INSERT INTO settings (key, value) 
            VALUES ('linkedin_group_id', '120363305030369507@g.us')
            ON CONFLICT (key) DO UPDATE SET value = '120363305030369507@g.us'
        `);
        console.log('✅ Updated linkedin_group_id to 120363305030369507@g.us');
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
