/**
 * Cleanup Orphaned Activities
 * 
 * Removes activities that reference non-existent leads before running migrations
 */

import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load production environment
dotenv.config({ path: '.env.production' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL not set!');
    process.exit(1);
}

const pool = new Pool({ connectionString });

async function cleanupOrphanedData() {
    try {
        console.log('🔍 Finding orphaned activities...\n');

        // Find orphaned activities
        const orphaned = await pool.query(`
            SELECT a.id, a.contact_cpf, a.type, a.title, a.created_at
            FROM activities a
            LEFT JOIN leads l ON a.contact_cpf = l.cpf
            WHERE l.cpf IS NULL
            ORDER BY a.created_at DESC
        `);

        if (orphaned.rows.length === 0) {
            console.log('✅ No orphaned activities found!');
            return;
        }

        console.log(`Found ${orphaned.rows.length} orphaned activities:`);
        orphaned.rows.forEach(row => {
            console.log(`  - ID: ${row.id}, CPF: ${row.contact_cpf}, Type: ${row.type}, Title: ${row.title}`);
        });

        console.log('\n🗑️  Deleting orphaned activities...');

        // Delete orphaned activities
        const result = await pool.query(`
            DELETE FROM activities
            WHERE contact_cpf NOT IN (SELECT cpf FROM leads)
        `);

        console.log(`✅ Deleted ${result.rowCount} orphaned activities\n`);

        // Verify cleanup
        const remaining = await pool.query(`
            SELECT COUNT(*) as count
            FROM activities a
            LEFT JOIN leads l ON a.contact_cpf = l.cpf
            WHERE l.cpf IS NULL
        `);

        console.log(`Remaining orphaned activities: ${remaining.rows[0].count}`);

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

cleanupOrphanedData()
    .then(() => {
        console.log('\n✅ Cleanup completed successfully!');
        console.log('You can now run: npm run migrate:prod');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Cleanup failed:', error.message);
        process.exit(1);
    });
