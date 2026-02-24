import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { pool } from './src/lib/db';
async function run() {
    try {
        const res = await pool.query("SELECT * FROM settings WHERE key = 'linkedin_group_id'");
        console.log("linkedin_group_id:", res.rows[0]?.value);
    } catch(e) {
        console.error(e);
    }
    const fs = require('fs');
    if (fs.existsSync('logs/app.log')) {
        console.log("logs/app.log last 20 lines:");
        const lines = fs.readFileSync('logs/app.log', 'utf8').split('\n');
        console.log(lines.slice(-20).join('\n'));
    }
    process.exit(0);
}
run();
