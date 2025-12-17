/**
 * Seed Script for Test Database
 * 
 * Usage:
 * export DATABASE_URL='...' (or load from .env.test)
 * npx ts-node scripts/seed_test_db.ts
 */

import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.test specifically
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// Use relative path with explicit extension only if allowImportingTsExtensions is on, otherwise try without
// The previous errors suggest complexity with resolution.
// trying standard relative path. If it fails, we might need to adjust command execution.
import { initializeDatabase, pool } from '../src/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Mock Data Generators
const FIRST_NAMES = ['Ana', 'Bruno', 'Carlos', 'Daniela', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Julia', 'Lucas', 'Mariana', 'Nicolas', 'Olivia', 'Pedro', 'Ramon', 'Sofia', 'Thiago', 'Ursula', 'Vinicius'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida'];
const STATUSES = ['NOVO', 'LEAD', 'Inscrito Confirmado', 'Aprovado', 'Reprovado', 'Matrícula Confirmada', 'Desistente'];
const COURSES = ['Análise e Desenvolvimento de Sistemas', 'Direito', 'Administração', 'Psicologia', 'Engenharia de Software'];

function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
    return '55519' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
}

function randomDate(start: Date, end: Date) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seed() {
    console.log('🌱 Seeding Test Database...');
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.error('DATABASE_URL not found in .env.test');
        process.exit(1);
    }
    console.log('Target DB:', url.split('@')[1] || 'Unknown');

    try {
        // 1. Initialize Schema (Tables, Indexes, Default Data)
        await initializeDatabase();

        console.log('🧹 Clearing existing test data (optional)...');
        // Uncomment to clear data before seeding
        // await pool.query('DELETE FROM leads'); 

        // 2. Insert Bulk Leads (30 leads)
        console.log('👥 Inserting 30 random leads...');
        for (let i = 0; i < 30; i++) {
            const firstName = randomElement(FIRST_NAMES);
            const lastName = randomElement(LAST_NAMES);
            const cpf = Math.floor(Math.random() * 10000000000).toString().padStart(11, '0');
            const created = randomDate(new Date(2025, 0, 1), new Date()); // Jan 2025 to now

            const lead = {
                cpf,
                nome: `${firstName} ${lastName}`,
                email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
                telefone: randomPhone(),
                status: randomElement(STATUSES),
                tipo_ingresso: 'Vestibular',
                curso_interesse: randomElement(COURSES),
                created_at: created,
                whatsapp_valido: Math.random() > 0.1 ? 1 : 0 // 90% valid
            };

            await pool.query(`
                INSERT INTO leads (cpf, nome, email, telefone, status, tipo_ingresso, curso_interesse, created_at, whatsapp_valido, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                ON CONFLICT (cpf) DO NOTHING
            `, Object.values(lead));

            // 3. Insert Messages for some leads
            if (Math.random() > 0.5) {
                const messageCount = Math.floor(Math.random() * 5) + 1;
                for (let j = 0; j < messageCount; j++) {
                    const fromMe = Math.random() > 0.5;
                    const msgTime = new Date(created.getTime() + j * 1000 * 60 * 60); // hours later

                    await pool.query(`
                        INSERT INTO messages (id, contact_phone, content, from_me, type, timestamp, read)
                        VALUES ($1, $2, $3, $4, 'text', $5, $6)
                    `, [
                        uuidv4(),
                        lead.cpf,
                        fromMe ? `Olá ${firstName}, como podemos ajudar?` : 'Gostaria de saber mais sobre o curso.',
                        fromMe,
                        msgTime,
                        true
                    ]);
                }
            }
        }

        // 4. Update specific "Ramon" lead for manual testing if not exists
        const ramonLead = {
            cpf: '00659422050',
            nome: 'Ramon Lummertz',
            email: 'ramon@example.com',
            telefone: '5551981636027',
            status: 'Matrícula Confirmada',
            tipo_ingresso: 'Transferência'
        };

        await pool.query(`
            INSERT INTO leads (cpf, nome, email, telefone, status, tipo_ingresso, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (cpf) DO UPDAte SET 
                nome = $2, telefone = $4, status = $5
        `, [
            ramonLead.cpf, ramonLead.nome, ramonLead.email, ramonLead.telefone, ramonLead.status, ramonLead.tipo_ingresso
        ]);

        console.log('✅ Seeding complete! 30+ Leads and Messages inserted.');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('🏁 Connection closed');
    }
}

seed();
