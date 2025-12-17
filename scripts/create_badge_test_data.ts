/**
 * Script to create test data for status badges
 * - Sets some leads with recent status changes (< 72h)
 * - Sets some leads with frozen status (> 7 days)
 */

import { pool } from '../src/lib/neonDb';

async function createTestData() {
    console.log('🧪 Creating test data for status badges...\n');

    try {
        // Get 3 random leads for "recent" badge
        const recentLeads = await pool.query(`
            SELECT cpf, nome FROM leads LIMIT 3
        `);

        // Set their status_changed_at to 24 hours ago (recent)
        for (const lead of recentLeads.rows) {
            await pool.query(`
                UPDATE leads 
                SET status_changed_at = NOW() - INTERVAL '24 hours'
                WHERE cpf = $1
            `, [lead.cpf]);
            console.log(`🔥 Set RECENT badge for: ${lead.nome}`);
        }

        // Get 3 more leads for "frozen" badge
        const frozenLeads = await pool.query(`
            SELECT cpf, nome FROM leads OFFSET 3 LIMIT 3
        `);

        // Set their status_changed_at to 10 days ago (frozen)
        for (const lead of frozenLeads.rows) {
            await pool.query(`
                UPDATE leads 
                SET status_changed_at = NOW() - INTERVAL '10 days'
                WHERE cpf = $1
            `, [lead.cpf]);
            console.log(`❄️  Set FROZEN badge for: ${lead.nome}`);
        }

        console.log('\n✅ Test data created successfully!');
        console.log('\n📋 Summary:');
        console.log('  - 3 leads with RECENT badge (< 72h)');
        console.log('  - 3 leads with FROZEN badge (> 7 days)');
        console.log('\n💡 Refresh the /contacts page to see the badges!');

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

createTestData();
