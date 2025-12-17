/**
 * Script to tag existing forwarded leads with "Comercial" tag
 * Adds the tag to all leads that have been forwarded to commercial team
 */

import { pool } from '../src/lib/neonDb';

async function tagExistingForwards() {
    console.log('🏷️  Tagging existing forwarded leads with "Comercial"...\n');

    try {
        // Get or create "Comercial" tag
        let tagResult = await pool.query(
            `SELECT id FROM tags WHERE name = 'Comercial' AND active = 1`
        );

        let tagId;
        if (tagResult.rows.length === 0) {
            const createResult = await pool.query(
                `INSERT INTO tags (name, color, description, active)
                 VALUES ('Comercial', '#8b5cf6', 'Lead encaminhado para o time comercial', 1)
                 RETURNING id`
            );
            tagId = createResult.rows[0].id;
            console.log('✅ Created "Comercial" tag');
        } else {
            tagId = tagResult.rows[0].id;
            console.log('✅ Found existing "Comercial" tag (ID: ' + tagId + ')');
        }

        // Get all CPFs that have been forwarded
        const forwardedResult = await pool.query(`
            SELECT DISTINCT contact_cpf 
            FROM activities 
            WHERE type = 'forwarded'
        `);

        console.log(`\n📋 Found ${forwardedResult.rows.length} forwarded leads`);

        if (forwardedResult.rows.length === 0) {
            console.log('\n⚠️  No forwarded leads found. Nothing to tag.');
            return;
        }

        // Tag each one
        let tagged = 0;
        for (const row of forwardedResult.rows) {
            const result = await pool.query(
                `INSERT INTO lead_tags (lead_cpf, tag_id)
                 VALUES ($1, $2)
                 ON CONFLICT (lead_cpf, tag_id) DO NOTHING
                 RETURNING id`,
                [row.contact_cpf, tagId]
            );

            if (result.rowCount && result.rowCount > 0) {
                tagged++;
            }
        }

        console.log(`\n✅ Tagged ${tagged} leads with "Comercial"`);
        console.log(`ℹ️  ${forwardedResult.rows.length - tagged} leads already had the tag`);

    } catch (error) {
        console.error('\n❌ Error:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

tagExistingForwards();
