
import { pool } from '../src/lib/db';

async function checkTemplates() {
    try {
        const result = await pool.query('SELECT id, template_name, status FROM ycloud_templates');
        console.log('Current YCloud Templates:');
        console.table(result.rows);
        process.exit(0);
    } catch (error) {
        console.error('Error querying templates:', error);
        process.exit(1);
    }
}

checkTemplates();
