const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../crm.db');
const db = new Database(dbPath);

const phone = '555199999999';
const message = process.argv[2] || 'Tem aula hoje?';

try {
    // Check if lead exists
    const lead = db.prepare('SELECT * FROM leads WHERE telefone = ?').get(phone);

    if (lead) {
        db.prepare(`
            UPDATE leads 
            SET last_message = ?, 
                last_message_time = CURRENT_TIMESTAMP, 
                unread_count = unread_count + 1 
            WHERE telefone = ?
        `).run(message, phone);
    } else {
        // Use a random CPF to avoid unique constraint error
        const randomCpf = Math.floor(Math.random() * 10000000000).toString();
        db.prepare(`
            INSERT INTO leads (cpf, nome, telefone, last_message, last_message_time, unread_count)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
        `).run(randomCpf, 'Teste User', phone, message);
    }

    console.log('Mensagem simulada inserida com sucesso!');
    console.log(`Telefone: ${phone}`);
    console.log(`Mensagem: ${message}`);
} catch (error) {
    console.error('Erro ao simular mensagem:', error);
}
