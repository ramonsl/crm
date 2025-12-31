
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { neon } = require('@neondatabase/serverless');

async function importLeads() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL not found in .env.local');
        process.exit(1);
    }

    const sql = neon(process.env.DATABASE_URL);
    const inputFile = path.join(process.cwd(), 'alunos_formados_contato.csv');

    const fileStream = fs.createReadStream(inputFile);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    let errors = 0;
    let isHeader = true;

    console.log('Starting import...');

    for await (const line of rl) {
        if (isHeader) {
            isHeader = false;
            continue;
        }

        // Simple CSV parse expecting "Name","Phone"
        const matches = line.match(/"([^"]+)"/g);
        if (!matches || matches.length < 2) continue;

        const nome = matches[0].replace(/"/g, '');
        const telefone = matches[1].replace(/"/g, '');
        const cpf = telefone; // Requirements: CPF = Telefone

        try {
            await sql`
                INSERT INTO leads (
                    cpf, nome, telefone, email, status, curso_interesse, notes, created_at
                ) VALUES (
                    ${cpf}, 
                    ${nome}, 
                    ${telefone}, 
                    '', 
                    'LEAD', 
                    'POS', 
                    'Semestre: 2026/1',
                    NOW()
                )
                ON CONFLICT (cpf) DO NOTHING
            `;
            process.stdout.write('.');
            count++;
        } catch (err) {
            console.error(`\nError importing ${nome}:`, err.message);
            errors++;
        }
    }

    console.log(`\nImport complete!`);
    console.log(`Success: ${count}`);
    console.log(`Errors: ${errors}`);
}

importLeads();
