/**
 * Migration script to add status_changed_at column and populate it
 */

import { pool } from '../src/lib/neonDb';

async function addStatusChangedAtColumn() {
    console.log('🔄 Adding status_changed_at column...');

    try {
        // Add the column
        await pool.query(`
            ALTER TABLE leads 
            ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP
        `);

        console.log('✅ Column added successfully');

        // Populate existing records
        const result = await pool.query(`
            UPDATE leads 
            SET status_changed_at = updated_at 
            WHERE status_changed_at IS NULL
        `);

        console.log(`✅ Populated ${result.rowCount} leads with status_changed_at`);

        // Show some sample data
        const sample = await pool.query(`
            SELECT cpf, nome, status, status_changed_at, updated_at 
            FROM leads 
            LIMIT 5
        `);

        console.log('\n📊 Sample data:');
        sample.rows.forEach(row => {
            console.log(`  ${row.nome}: ${row.status} (changed at: ${row.status_changed_at})`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

addStatusChangedAtColumn();
