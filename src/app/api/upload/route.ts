import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import db from '@/lib/db';
import { normalizePhone } from '@/lib/utils';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // Read all rows as arrays to find header dynamically
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        console.log(`[Import] Total raw rows: ${rawRows.length}`);

        // Find header row index (look for 'CPF' or 'Inscrição')
        const headerIndex = rawRows.findIndex(row =>
            row.some(cell => String(cell).toLowerCase().includes('cpf') || String(cell).toLowerCase().includes('inscrição'))
        );

        if (headerIndex === -1) {
            console.error('[Import] Could not find header row');
            return NextResponse.json({ error: 'Could not find header row (CPF/Inscrição)' }, { status: 400 });
        }

        console.log(`[Import] Header found at index ${headerIndex}:`, rawRows[headerIndex]);

        const headers = rawRows[headerIndex].map(h => String(h).trim());
        const dataRows = rawRows.slice(headerIndex + 1);

        // Convert to objects
        const data = dataRows.map(row => {
            const obj: any = {};
            headers.forEach((h, i) => {
                obj[h] = row[i];
            });
            return obj;
        });

        console.log(`[Import] Processed ${data.length} data rows`);

        let created = 0;
        let updated = 0;

        const insertStmt = db.prepare(`
      INSERT INTO leads (cpf, nome, email, telefone, tipo_ingresso, status, data_inscricao, is_new, last_import_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `);

        const updateStmt = db.prepare(`
      UPDATE leads SET status = ?, tipo_ingresso = ?, data_inscricao = ?, updated_at = CURRENT_TIMESTAMP WHERE cpf = ?
    `);

        const checkStmt = db.prepare(`SELECT cpf FROM leads WHERE cpf = ?`);

        const transaction = db.transaction((rows: any[]) => {
            for (const row of rows) {
                // Helper to find value by fuzzy key match
                const getVal = (keywords: string[]) => {
                    // 1. Try exact match first
                    let foundKey = Object.keys(row).find(k =>
                        keywords.some(keyword => k.toLowerCase() === keyword.toLowerCase())
                    );

                    // 2. If not found, try partial match but avoid "ID" or "Cod" columns
                    if (!foundKey) {
                        foundKey = Object.keys(row).find(k =>
                            keywords.some(keyword => k.toLowerCase().includes(keyword.toLowerCase())) &&
                            !k.toLowerCase().startsWith('id ') &&
                            !k.toLowerCase().startsWith('cod') &&
                            !k.toLowerCase().startsWith('código')
                        );
                    }
                    return foundKey ? row[foundKey] : null;
                };

                const cpfRaw = getVal(['CPF']);
                if (!cpfRaw) {
                    // console.log('[Import] Skipping row: Missing CPF');
                    continue;
                }

                // Clean CPF
                const cpf = String(cpfRaw).replace(/\D/g, '');
                if (!cpf) continue;

                const nome = getVal(['Nome', 'Candidato']) || '';
                const email = getVal(['E-mail', 'Email']) || '';

                // Phone Logic: Try Celular, then Fone Res, then generic
                let telefoneRaw = row['Celular'] || row['Fone Res.'] || getVal(['telefone', 'celular', 'fone']);
                let telefone = '';

                if (telefoneRaw) {
                    // Extract digits
                    const digits = String(telefoneRaw).replace(/\D/g, '');
                    // Basic validation: at least 10 digits (DDD + Number)
                    if (digits.length >= 10) {
                        telefone = normalizePhone(digits);
                    }
                }

                const status = getVal(['Situação', 'Status']) || '';
                const data_inscricao = getVal(['Dt. Inscrição', 'Data Inscrição']) || null;

                // Extract semester from 'processo de ingresso'
                // Using specific keyword and relying on getVal to skip "ID ..."
                const rawIngresso = getVal(['Processo de Ingresso', 'ingresso']) || '';
                let tipo_ingresso = '';

                const semesterMatch = String(rawIngresso).match(/(\d{4}[./-]\d{1,2})/);
                if (semesterMatch) {
                    tipo_ingresso = semesterMatch[1].replace('.', '/').replace('-', '/');
                }

                const existing = checkStmt.get(cpf) as any;

                if (existing) {
                    let notes = existing.notes || '';
                    let statusChanged = 0;

                    if (existing.status !== status) {
                        const date = new Date().toLocaleDateString('pt-BR');
                        notes = `${notes ? notes + '\n' : ''}[${date}] Status alterado: ${existing.status} -> ${status}`;
                        statusChanged = 1;
                    }

                    // Update status, semester, notes, and tracking fields
                    const updateFullStmt = db.prepare(`
                        UPDATE leads 
                        SET status = ?, tipo_ingresso = ?, data_inscricao = ?, notes = ?, 
                            is_new = 0, status_changed = ?, last_import_date = CURRENT_TIMESTAMP, 
                            updated_at = CURRENT_TIMESTAMP 
                        WHERE cpf = ?
                    `);
                    updateFullStmt.run(status, tipo_ingresso, data_inscricao, notes, statusChanged, cpf);
                    updated++;
                } else {
                    insertStmt.run(cpf, nome, email, telefone, tipo_ingresso, status, data_inscricao);
                    created++;
                }
            }
        });

        transaction(data);

        return NextResponse.json({ message: 'Success', created, updated });
    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
