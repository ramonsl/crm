import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import db from '@/lib/db';
import { normalizePhone } from '@/lib/utils';
import { ActivityRepository } from '@/lib/repositories';
import { ActivityService } from '@/services/activityService';

// Initialize activity service for logging
const activityRepository = new ActivityRepository(db);
const activityService = new ActivityService(activityRepository);

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

        const checkStmt = db.prepare(`SELECT * FROM leads WHERE cpf = ?`);

        // Verifica se existe registro com mesmo telefone (para prevenção de duplicatas)
        const checkPhoneStmt = db.prepare(`SELECT * FROM leads WHERE telefone = ? AND cpf != ?`);

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
                    let anyDataChanged = false;

                    // Normalize status for comparison
                    const existingStatus = (existing.status || '').trim();
                    const newStatus = (status || '').trim();
                    const existingNome = (existing.nome || '').trim();
                    const existingTelefone = (existing.telefone || '').trim();
                    const existingEmail = (existing.email || '').trim();

                    // Check if status actually changed (case-insensitive comparison)
                    if (existingStatus.toLowerCase() !== newStatus.toLowerCase() && newStatus !== '') {
                        const date = new Date().toLocaleDateString('pt-BR');
                        notes = `${notes ? notes + '\n' : ''}[${date}] Status alterado: ${existingStatus} -> ${newStatus}`;
                        statusChanged = 1;
                        anyDataChanged = true;
                    }

                    // Check if other data changed
                    if (existingNome !== (nome || '').trim() ||
                        existingTelefone !== (telefone || '').trim() ||
                        existingEmail !== (email || '').trim()) {
                        anyDataChanged = true;
                    }

                    // Only update and count if something actually changed
                    if (anyDataChanged || statusChanged) {
                        const updateFullStmt = db.prepare(`
                            UPDATE leads 
                            SET status = ?, tipo_ingresso = ?, data_inscricao = ?, notes = ?, 
                                is_new = 0, status_changed = ?, last_import_date = CURRENT_TIMESTAMP, 
                                updated_at = CURRENT_TIMESTAMP 
                            WHERE cpf = ?
                        `);
                        updateFullStmt.run(newStatus || existingStatus, tipo_ingresso, data_inscricao, notes, statusChanged, cpf);
                        updated++;

                        // Log status change to activity timeline ONLY if status actually changed
                        if (statusChanged) {
                            try {
                                activityService.logStatusChange(cpf, existingStatus, newStatus);
                            } catch (e) {
                                console.error('[Import] Error logging activity:', e);
                            }
                        }
                    }
                } else {
                    // Verifica se já existe alguém com esse telefone (prevenção de duplicatas)
                    const existingByPhone = telefone ? checkPhoneStmt.get(telefone, cpf) as any : null;

                    if (existingByPhone && telefone) {
                        // Encontrou registro com mesmo telefone - fazer merge
                        console.log(`[Import] Merge por telefone: ${telefone} (CPF atual: ${cpf}, CPF existente: ${existingByPhone.cpf})`);

                        // Determinar qual status é mais avançado (inscrito > lead)
                        const statusPriority: Record<string, number> = {
                            'NOVO': 1,
                            'LEAD': 2,
                            'EM_CONTATO': 3,
                            'INSCRITO': 4,
                            'Inscrito Confirmado': 5,
                            'Aprovado': 6,
                            'APROVADO': 6,
                            'Pagamento da Matrícula Iniciado': 7,
                            'Matricula Confirmada': 8,
                            'MATRICULADO': 8,
                            'Reprovado': 0,
                            'REPROVADO': 0,
                            'Desistente': 0,
                            'DESISTENTE': 0,
                        };

                        const existingPriority = statusPriority[existingByPhone.status] || 0;
                        const newPriority = statusPriority[status] || 0;

                        // Se o novo status é mais avançado, atualiza
                        const finalStatus = newPriority > existingPriority ? status : existingByPhone.status;

                        // Merge: preenche campos vazios do registro existente
                        const mergedNome = existingByPhone.nome || nome;
                        const mergedEmail = existingByPhone.email || email;
                        const mergedTipoIngresso = tipo_ingresso || existingByPhone.tipo_ingresso;

                        const date = new Date().toLocaleDateString('pt-BR');
                        const mergeNote = `[${date}] Merge automático: CPF ${cpf} mesclado (telefone duplicado)`;
                        const mergedNotes = existingByPhone.notes ? existingByPhone.notes + '\n' + mergeNote : mergeNote;

                        const mergeStmt = db.prepare(`
                            UPDATE leads 
                            SET nome = COALESCE(NULLIF(?, ''), nome),
                                email = COALESCE(NULLIF(?, ''), email),
                                status = ?,
                                tipo_ingresso = COALESCE(NULLIF(?, ''), tipo_ingresso),
                                data_inscricao = COALESCE(?, data_inscricao),
                                notes = ?,
                                is_new = 0,
                                status_changed = CASE WHEN status != ? THEN 1 ELSE status_changed END,
                                last_import_date = CURRENT_TIMESTAMP,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE cpf = ?
                        `);

                        mergeStmt.run(
                            mergedNome,
                            mergedEmail,
                            finalStatus,
                            mergedTipoIngresso,
                            data_inscricao,
                            mergedNotes,
                            finalStatus,
                            existingByPhone.cpf
                        );

                        updated++;

                        // Log merge activity
                        if (existingByPhone.status !== finalStatus) {
                            try {
                                activityService.logStatusChange(existingByPhone.cpf, existingByPhone.status, finalStatus);
                            } catch (e) {
                                console.error('[Import] Error logging merge activity:', e);
                            }
                        }
                    } else {
                        // Nenhuma duplicata encontrada - inserir novo registro
                        insertStmt.run(cpf, nome, email, telefone, tipo_ingresso, status, data_inscricao);
                        created++;

                        // Log new lead creation to activity timeline
                        try {
                            activityService.logLeadCreated(cpf, nome || cpf, 'importação Prime');
                        } catch (e) {
                            console.error('[Import] Error logging activity:', e);
                        }
                    }
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
