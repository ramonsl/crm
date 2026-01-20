import { pool } from '../src/lib/db';

async function checkProvider() {
    try {
        const result = await pool.query("SELECT * FROM settings WHERE key = 'whatsapp_provider'");
        console.log('Current Provider Setting:', result.rows[0]);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkProvider();
