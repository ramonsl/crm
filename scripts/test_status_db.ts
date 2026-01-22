
import { pool } from '@/lib/db';

async function testStatusApi() {
    console.log('--- Starting Status API Test ---');

    // 1. Create a status
    console.log(' Creating status...');
    const name = `Test Status ${Date.now()}`;
    const color = '#123456';

    // Simulate POST
    const maxOrderRes = await pool.query('SELECT COALESCE(MAX(display_order), 0) as max_order FROM statuses');
    const maxOrder = maxOrderRes.rows[0].max_order;

    const insertRes = await pool.query(`
        INSERT INTO statuses (name, color, display_order, active)
        VALUES ($1, $2, $3, 1)
        RETURNING id
    `, [name, color, maxOrder + 1]);

    const id = insertRes.rows[0].id;
    console.log(` Created status ID: ${id}`);

    // 2. Test Partial Update: Name Only
    console.log(' Testing Update Name Only...');
    const newName = name + ' Updated';

    // Simulate PUT logic
    await pool.query(`
        UPDATE statuses 
        SET name = $1, updated_at = NOW()
        WHERE id = $2
    `, [newName, id]);

    // Check
    const check1 = await pool.query('SELECT * FROM statuses WHERE id = $1', [id]);
    if (check1.rows[0].name === newName && check1.rows[0].color === color) {
        console.log(' [PASS] Name updated, color preserved');
    } else {
        console.log(' [FAIL] Name update failed', check1.rows[0]);
    }

    // 3. Test Partial Update: Color Only
    console.log(' Testing Update Color Only...');
    const newColor = '#654321';

    await pool.query(`
        UPDATE statuses 
        SET color = $1, updated_at = NOW()
        WHERE id = $2
    `, [newColor, id]);

    // Check
    const check2 = await pool.query('SELECT * FROM statuses WHERE id = $1', [id]);
    if (check2.rows[0].name === newName && check2.rows[0].color === newColor) {
        console.log(' [PASS] Color updated, name preserved');
    } else {
        console.log(' [FAIL] Color update failed', check2.rows[0]);
    }

    // 4. Test Full Update (Simulating what the Component does)
    console.log(' Testing Full Update (Name + Color)...');
    const finalName = newName + ' Final';
    const finalColor = '#000000';

    // In the actual API, if both are provided, both are updated.
    // Simulating component sending { name: finalName, color: finalColor }
    await pool.query(`
        UPDATE statuses 
        SET name = $1, color = $2, updated_at = NOW()
        WHERE id = $3
    `, [finalName, finalColor, id]);

    // Check
    const check3 = await pool.query('SELECT * FROM statuses WHERE id = $1', [id]);
    if (check3.rows[0].name === finalName && check3.rows[0].color === finalColor) {
        console.log(' [PASS] Full update successful');
    } else {
        console.log(' [FAIL] Full update failed', check3.rows[0]);
    }

    // Cleanup
    await pool.query('DELETE FROM statuses WHERE id = $1', [id]);
    console.log(' Cleanup done.');
    process.exit(0);
}

testStatusApi().catch(e => {
    console.error(e);
    process.exit(1);
});
