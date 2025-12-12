import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { pool } from '@/lib/db';
import { normalizePhone } from '@/lib/utils';
import { ActivityRepository } from '@/lib/repositories';
import { ActivityService } from '@/services/activityService';

// Initialize activity service for logging
const activityRepository = new ActivityRepository();
const activityService = new ActivityService(activityRepository);

const STATUS_PRIORITY: Record<string, number> = {
    'NOVO': 1, 'LEAD': 2, 'EM_CONTATO': 3, 'INSCRITO': 4,
    'Inscrito Confirmado': 5, 'Aprovado': 6, 'APROVADO': 6,
    'Pagamento da Matrícula Iniciado': 7, 'Matricula Confirmada': 8, 'MATRICULADO': 8,
    'Reprovado': 0, 'REPROVADO': 0, 'Desistente': 0, 'DESISTENTE': 0,
};

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
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        console.log(`[Import] Total raw rows: ${rawRows.length}`);

        const headerIndex = rawRows.findIndex(row =>
            row.some(cell => String(cell).toLowerCase().includes('cpf') || String(cell).toLowerCase().includes('inscrição'))
        );

        if (headerIndex === -1) {
            return NextResponse.json({ error: 'Could not find header row (CPF/Inscrição)' }, { status: 400 });
        }

        const headers = rawRows[headerIndex].map(h => String(h).trim());
        const dataRows = rawRows.slice(headerIndex + 1);

        const data = dataRows.map(row => {
            const obj: any = {};
            headers.forEach((h, i) => { obj[h] = row[i]; });
            return obj;
        });

        console.log(`[Import] Processed ${data.length} data rows`);

        let created = 0;
        let updated = 0;

        // Process each row
        for (const row of data) {
            const getVal = (keywords: string[]) => {
                let foundKey = Object.keys(row).find(k =>
                    keywords.some(keyword => k.toLowerCase() === keyword.toLowerCase())
                );
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
            if (!cpfRaw) continue;

            const cpf = String(cpfRaw).replace(/\D/g, '');
            if (!cpf) continue;

            const nome = getVal(['Nome', 'Candidato']) || '';
            const email = getVal(['E-mail', 'Email']) || '';

            let telefoneRaw = row['Celular'] || row['Fone Res.'] || getVal(['telefone', 'celular', 'fone']);
            let telefone = '';

            if (telefoneRaw) {
                const digits = String(telefoneRaw).replace(/\D/g, '');
                if (digits.length >= 10) {
                    telefone = normalizePhone(digits);
                }
            }

            const status = getVal(['Situação', 'Status']) || '';
            const data_inscricao = getVal(['Dt. Inscrição', 'Data Inscrição']) || null;

            const rawIngresso = getVal(['Processo de Ingresso', 'ingresso']) || '';
            let tipo_ingresso = '';
            const semesterMatch = String(rawIngresso).match(/(\d{4}[./-]\d{1,2})/);
            if (semesterMatch) {
                tipo_ingresso = semesterMatch[1].replace('.', '/').replace('-', '/');
            }

            // Check if exists
            const existingResult = await pool.query('SELECT * FROM leads WHERE cpf = $1', [cpf]);
            const existing = existingResult.rows[0];

            if (existing) {
                let notes = existing.notes || '';
                let statusChanged = 0;
                let anyDataChanged = false;

                const existingStatus = (existing.status || '').trim();
                const newStatus = (status || '').trim();

                if (existingStatus.toLowerCase() !== newStatus.toLowerCase() && newStatus !== '') {
                    const date = new Date().toLocaleDateString('pt-BR');
                    notes = `${notes ? notes + '\n' : ''}[${date}] Status alterado: ${existingStatus} -> ${newStatus}`;
                    statusChanged = 1;
                    anyDataChanged = true;
                }

                if (anyDataChanged || statusChanged) {
                    await pool.query(`
                        UPDATE leads SET status = $1, tipo_ingresso = $2, data_inscricao = $3, 
                            notes = $4, is_new = 0, status_changed = $5, 
                            last_import_date = NOW(), updated_at = NOW()
                        WHERE cpf = $6
                    `, [newStatus || existingStatus, tipo_ingresso, data_inscricao, notes, statusChanged, cpf]);
                    updated++;

                    if (statusChanged) {
                        try {
                            await activityService.logStatusChange(cpf, existingStatus, newStatus);
                        } catch (e) {
                            console.error('[Import] Error logging activity:', e);
                        }
                    }
                }
            } else {
                // Check for phone duplicate
                const phoneResult = telefone
                    ? await pool.query('SELECT * FROM leads WHERE telefone = $1 AND cpf != $2', [telefone, cpf])
                    : { rows: [] };
                const existingByPhone = phoneResult.rows[0];

                if (existingByPhone && telefone) {
                    // Merge by phone
                    const existingPriority = STATUS_PRIORITY[existingByPhone.status] || 0;
                    const newPriority = STATUS_PRIORITY[status] || 0;
                    const finalStatus = newPriority > existingPriority ? status : existingByPhone.status;

                    const date = new Date().toLocaleDateString('pt-BR');
                    const mergeNote = `[${date}] Merge automático: CPF ${cpf} mesclado (telefone duplicado)`;
                    const mergedNotes = existingByPhone.notes ? existingByPhone.notes + '\n' + mergeNote : mergeNote;

                    await pool.query(`
                        UPDATE leads SET
                            nome = COALESCE(NULLIF($1, ''), nome),
                            email = COALESCE(NULLIF($2, ''), email),
                            status = $3,
                            tipo_ingresso = COALESCE(NULLIF($4, ''), tipo_ingresso),
                            data_inscricao = COALESCE($5, data_inscricao),
                            notes = $6,
                            is_new = 0,
                            status_changed = CASE WHEN status != $3 THEN 1 ELSE status_changed END,
                            last_import_date = NOW(),
                            updated_at = NOW()
                        WHERE cpf = $7
                    `, [nome, email, finalStatus, tipo_ingresso, data_inscricao, mergedNotes, existingByPhone.cpf]);

                    updated++;

                    if (existingByPhone.status !== finalStatus) {
                        try {
                            await activityService.logStatusChange(existingByPhone.cpf, existingByPhone.status, finalStatus);
                        } catch (e) {
                            console.error('[Import] Error logging merge activity:', e);
                        }
                    }
                } else {
                    // Insert new
                    await pool.query(`
                        INSERT INTO leads (cpf, nome, email, telefone, tipo_ingresso, status, data_inscricao, is_new, last_import_date)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW())
                    `, [cpf, nome, email, telefone, tipo_ingresso, status, data_inscricao]);
                    created++;

                    try {
                        await activityService.logLeadCreated(cpf, nome || cpf, 'importação Prime');
                    } catch (e) {
                        console.error('[Import] Error logging activity:', e);
                    }
                }
            }
        }

        return NextResponse.json({ message: 'Success', created, updated });
    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
