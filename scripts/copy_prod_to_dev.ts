/**
 * Copy Production Data to Dev Database
 * 
 * This script copies all table data from production to dev database.
 * WARNING: This will TRUNCATE dev tables before copying!
 * 
 * Usage: npx ts-node scripts/copy_prod_to_dev.ts
 */

import { Pool } from 'pg';

// Database URLs
const PROD_URL = process.env.PROD_DATABASE_URL ||
    '***REMOVIDO***';

const DEV_URL = process.env.DEV_DATABASE_URL ||
    '***REMOVIDO***';

// Tables to copy in order (respecting foreign key constraints)
// Delete in reverse order, insert in forward order
const TABLES_TO_COPY = [
    'settings',
    'status',
    'tags',
    'leads',
    'lead_tags',
    'message_template',
    'message_history',
    'auto_reply_rules',
    'ycloud_templates',
    'queue_idle_automation_config'
];

async function copyTable(prodPool: Pool, devPool: Pool, table: string): Promise<number> {
    // Check if table exists in prod
    const tableCheck = await prodPool.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
        )
    `, [table]);

    if (!tableCheck.rows[0].exists) {
        console.log(`   ⚠️ Table ${table} doesn't exist in production, skipping...`);
        return 0;
    }

    // Check if table exists in dev
    const devTableCheck = await devPool.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
        )
    `, [table]);

    if (!devTableCheck.rows[0].exists) {
        console.log(`   ⚠️ Table ${table} doesn't exist in dev, skipping...`);
        return 0;
    }

    // Get row count from prod
    const countResult = await prodPool.query(`SELECT COUNT(*) FROM "${table}"`);
    const rowCount = parseInt(countResult.rows[0].count);
    console.log(`   Found ${rowCount} rows in production`);

    if (rowCount === 0) {
        console.log(`   ⚠️ No data to copy, skipping...`);
        return 0;
    }

    // Get all data from prod
    const data = await prodPool.query(`SELECT * FROM "${table}"`);

    if (data.rows.length === 0) return 0;

    const columns = Object.keys(data.rows[0]);
    const columnNames = columns.map(c => `"${c}"`).join(', ');

    // Insert data
    let inserted = 0;

    for (const row of data.rows) {
        const values = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        const rowValues = columns.map(col => row[col]);

        try {
            await devPool.query(
                `INSERT INTO "${table}" (${columnNames}) VALUES (${values})
                 ON CONFLICT DO NOTHING`,
                rowValues
            );
            inserted++;
        } catch (err: unknown) {
            if (err instanceof Error) {
                console.error(`\n   ⚠️ Insert error: ${err.message.substring(0, 100)}`);
            }
        }

        if (inserted % 100 === 0) {
            process.stdout.write(`\r   Inserted: ${inserted}/${rowCount}`);
        }
    }

    return inserted;
}

async function copyProdToDev() {
    console.log('🔄 Starting production to dev data copy...\n');

    const prodPool = new Pool({ connectionString: PROD_URL });
    const devPool = new Pool({ connectionString: DEV_URL });

    try {
        // Test connections
        console.log('Testing production connection...');
        await prodPool.query('SELECT 1');
        console.log('✅ Production connected\n');

        console.log('Testing dev connection...');
        await devPool.query('SELECT 1');
        console.log('✅ Dev connected\n');

        // First, delete data in reverse order (child tables first)
        console.log('🗑️ Clearing dev tables...');
        const reverseTables = [...TABLES_TO_COPY].reverse();

        for (const table of reverseTables) {
            try {
                const result = await devPool.query(`DELETE FROM "${table}"`);
                console.log(`   Deleted ${result.rowCount} rows from ${table}`);
            } catch (err: unknown) {
                if (err instanceof Error && !err.message.includes('does not exist')) {
                    console.log(`   ⚠️ Could not clear ${table}: ${err.message.substring(0, 50)}`);
                }
            }
        }

        // Now copy data in forward order (parent tables first)
        console.log('\n📋 Copying data...');

        for (const table of TABLES_TO_COPY) {
            console.log(`\n📋 Processing table: ${table}`);

            try {
                const inserted = await copyTable(prodPool, devPool, table);
                console.log(`\n   ✅ Copied ${inserted} rows`);
            } catch (tableError) {
                console.error(`   ❌ Error processing ${table}:`, tableError);
            }
        }

        // Reset sequences for tables with auto-increment
        console.log('\n🔧 Resetting sequences...');
        for (const table of TABLES_TO_COPY) {
            try {
                await devPool.query(`
                    SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), 
                           COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)
                `);
            } catch {
                // Table might not have id column or sequence
            }
        }

        console.log('\n✅ Data copy complete!');

    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    } finally {
        await prodPool.end();
        await devPool.end();
    }
}

// Run
copyProdToDev();
