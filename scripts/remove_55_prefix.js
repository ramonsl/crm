const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../crm.db');
const db = new Database(dbPath);

console.log('Connected to database at:', dbPath);

try {
    // Check count before
    const countBefore = db.prepare("SELECT COUNT(*) as count FROM leads WHERE telefone LIKE '55%' AND (LENGTH(telefone) = 12 OR LENGTH(telefone) = 13)").get();
    console.log(`Found ${countBefore.count} numbers to update.`);

    if (countBefore.count > 0) {
        const updateStmt = db.prepare("UPDATE leads SET telefone = SUBSTR(telefone, 3) WHERE telefone LIKE '55%' AND (LENGTH(telefone) = 12 OR LENGTH(telefone) = 13)");
        const info = updateStmt.run();
        console.log(`Updated ${info.changes} rows.`);
    } else {
        console.log('No rows to update.');
    }

    // Verify a few
    const sample = db.prepare("SELECT telefone FROM leads LIMIT 5").all();
    console.log('Sample phones after update:', sample);

} catch (error) {
    console.error('Error updating database:', error);
} finally {
    db.close();
}
