import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { pool } from '@/lib/db';
import { normalizePhone } from '@/lib/utils';
import { ActivityRepository } from '@/lib/repositories';
import { ActivityService } from '@/services/activityService';
import { statusMessageService } from '@/services/StatusMessageService';
import type { UploadRow } from '@/types/import';

// Initialize activity service for logging
const activityRepository = new ActivityRepository();
const activityService = new ActivityService(activityRepository);

// Status priority from lowest (1) to highest (7)
// Only upgrade status, never downgrade
const STATUS_PRIORITY: Record<string, number> = {
    'LEAD': 1,
    'NOVO': 1,
    'EM_CONTATO': 1,
    'INSCRITO': 1,
    'Desistente': 2,
    'DESISTENTE': 2,
    'Reprovado': 3,
    'REPROVADO': 3,
    'Inscrito Confirmado': 4,
    'Aprovado': 5,
    'APROVADO': 5,
    'Pagamento da Matrícula Iniciado': 6,
    'Matricula Confirmada': 7,
    'MATRICULADO': 7,
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
            const obj: UploadRow = {};
            headers.forEach((h, i) => { obj[h] = row[i]; });
            return obj;
        });

        console.log(`[Import] Processed ${data.length} data rows`);

        // Helper function to extract values from row
        const getVal = (row: UploadRow, keywords: string[]) => {
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

        // ============================================================
        // PRE-PROCESSING: Consolidate duplicates by CPF
        // Keep only the row with the HIGHEST priority status
        // This prevents multiple status changes for the same lead
        // ============================================================
        const consolidatedData = new Map<string, { row: UploadRow, status: string, priority: number }>();
        let duplicatesFound = 0;

        for (const row of data) {
            const cpfRaw = getVal(row, ['CPF']);
            if (!cpfRaw) continue;

            const cpf = String(cpfRaw).replace(/\D/g, '');
            if (!cpf) continue;

            const status = String(getVal(row, ['Situação', 'Status', 'Status da Inscrição']) || '').trim();
            const priority = STATUS_PRIORITY[status] || 0;

            const existing = consolidatedData.get(cpf);
            if (existing) {
                duplicatesFound++;
                // Keep the one with higher priority
                if (priority > existing.priority) {
                    console.log(`[Import] CPF ${cpf}: Keeping "${status}" (priority ${priority}) over "${existing.status}" (priority ${existing.priority})`);
                    consolidatedData.set(cpf, { row, status, priority });
                } else {
                    console.log(`[Import] CPF ${cpf}: Ignoring "${status}" (priority ${priority}), keeping "${existing.status}" (priority ${existing.priority})`);
                }
            } else {
                consolidatedData.set(cpf, { row, status, priority });
            }
        }

        console.log(`[Import] Consolidated: ${data.length} rows -> ${consolidatedData.size} unique CPFs (${duplicatesFound} duplicates resolved)`);

        let created = 0;
        let updated = 0;
        let statusChanges = 0;  // Track actual status changes separately

        // Detailed tracking
        const createdLeads: Array<{ nome: string; cpf: string; status: string }> = [];
        const updatedLeads: Array<{ nome: string; cpf: string; oldStatus: string; newStatus: string }> = [];
        const skippedDowngrades: Array<{ nome: string; cpf: string; currentStatus: string; attemptedStatus: string }> = [];

        // Process each UNIQUE row (consolidated by CPF)
        for (const [cpf, { row, status: consolidatedStatus }] of consolidatedData) {
            // Use the helper function defined above with the current row
            const getRowVal = (keywords: string[]) => getVal(row, keywords);

            const nome = getRowVal(['Nome', 'Candidato']) || '';
            const email = getRowVal(['E-mail', 'Email']) || '';

            const telefoneRaw = row['Celular'] || row['Fone Res.'] || getRowVal(['telefone', 'celular', 'fone']);
            let telefone = '';

            if (telefoneRaw) {
                const digits = String(telefoneRaw).replace(/\D/g, '');
                if (digits.length >= 10) {
                    telefone = normalizePhone(digits);
                }
            }

            // Use consolidated status (highest priority from all rows with this CPF)
            const status = consolidatedStatus;
            const data_inscricao = getRowVal(['Dt. Inscrição', 'Data Inscrição']) || null;

            const rawIngresso = getRowVal(['Processo de Ingresso', 'ingresso']) || '';
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
                const newStatus = String(status || '').trim();

                // Check priority: only upgrade status, never downgrade
                const existingPriority = STATUS_PRIORITY[existingStatus] || 0;
                const newPriority = STATUS_PRIORITY[newStatus] || 0;

                // Determine final status based on priority
                let finalStatus = existingStatus;
                if (newStatus !== '' && newPriority >= existingPriority) {
                    // New status has equal or higher priority - allow update
                    if (existingStatus.toLowerCase() !== newStatus.toLowerCase()) {
                        const date = new Date().toLocaleDateString('pt-BR');
                        notes = `${notes ? notes + '\n' : ''}[${date}] Status alterado: ${existingStatus} -> ${newStatus}`;
                        statusChanged = 1;
                        anyDataChanged = true;
                        finalStatus = newStatus;
                        statusChanges++;
                        updatedLeads.push({ nome: String(nome || cpf), cpf, oldStatus: existingStatus, newStatus });
                    }
                } else if (newStatus !== '' && newPriority < existingPriority) {
                    // New status has lower priority - log but don't downgrade
                    const date = new Date().toLocaleDateString('pt-BR');
                    notes = `${notes ? notes + '\n' : ''}[${date}] Importação ignorada: tentativa de alterar ${existingStatus} para ${newStatus} (prioridade menor)`;
                    anyDataChanged = true;
                    skippedDowngrades.push({ nome: String(nome || cpf), cpf, currentStatus: existingStatus, attemptedStatus: newStatus });
                    console.log(`[Import] Skipping status downgrade for CPF ${cpf}: ${existingStatus} (${existingPriority}) -> ${newStatus} (${newPriority})`);
                }

                if (anyDataChanged || statusChanged) {
                    await pool.query(`
                        UPDATE leads SET status = $1, tipo_ingresso = $2, data_inscricao = $3, 
                            notes = $4, is_new = 0, status_changed = $5, 
                            status_changed_at = CASE WHEN $5 = 1 THEN NOW() ELSE status_changed_at END,
                            last_import_date = NOW(), updated_at = NOW()
                        WHERE cpf = $6
                    `, [finalStatus, tipo_ingresso, data_inscricao, notes, statusChanged, cpf]);
                    updated++;

                    if (statusChanged) {
                        try {
                            await activityService.logStatusChange(cpf, existingStatus, finalStatus);

                            // Trigger automated message if configured
                            const result = await statusMessageService.processStatusChange(cpf, existingStatus, finalStatus);
                            if (result.sent) {
                                console.log(`[Import] ✅ Automated message queued for status: ${finalStatus}`);
                            }
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
                            status_changed_at = CASE WHEN status != $3 THEN NOW() ELSE status_changed_at END,
                            last_import_date = NOW(),
                            updated_at = NOW()
                        WHERE cpf = $7
                    `, [nome, email, finalStatus, tipo_ingresso, data_inscricao, mergedNotes, existingByPhone.cpf]);

                    updated++;

                    if (existingByPhone.status !== finalStatus) {
                        try {
                            await activityService.logStatusChange(existingByPhone.cpf, existingByPhone.status, finalStatus);

                            // Trigger automated message if configured
                            const result = await statusMessageService.processStatusChange(existingByPhone.cpf, existingByPhone.status, finalStatus);
                            if (result.sent) {
                                console.log(`[Import] ✅ Automated message queued (merge) for status: ${finalStatus}`);
                            }
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
                    createdLeads.push({ nome: String(nome || cpf), cpf, status: String(status) });

                    try {
                        await activityService.logLeadCreated(cpf, String(nome || cpf), 'importação Prime');
                    } catch (e) {
                        console.error('[Import] Error logging activity:', e);
                    }
                }
            }
        }

        return NextResponse.json({
            message: 'Success',
            created,
            updated,
            statusChanges,  // Separate counter for actual status changes
            details: {
                createdLeads,
                updatedLeads,
                skippedDowngrades
            }
        });
    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
