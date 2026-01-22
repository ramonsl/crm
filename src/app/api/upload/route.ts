import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { normalizePhone } from '@/lib/utils';
import { LeadRepository, ActivityRepository } from '@/lib/repositories';
import { ActivityService } from '@/services/activityService';
import { statusMessageService } from '@/services/StatusMessageService';
import type { UploadRow } from '@/types/import';
import type { UpdateLeadDto, CreateLeadDto } from '@/lib/repositories/dtos';
import { handleApiError } from '@/lib/api/handleApiError';

// Initialize repositories and services
const leadRepository = new LeadRepository();
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
            const getRowVal = (keywords: string[]) => getVal(row, keywords);

            const nome = String(getRowVal(['Nome', 'Candidato']) || '');
            const email = String(getRowVal(['E-mail', 'Email']) || '');

            const telefoneRaw = row['Celular'] || row['Fone Res.'] || getRowVal(['telefone', 'celular', 'fone']);
            let telefone = '';

            if (telefoneRaw) {
                const digits = String(telefoneRaw).replace(/\D/g, '');
                if (digits.length >= 10) {
                    telefone = normalizePhone(digits);
                }
            }

            const status = consolidatedStatus;
            const data_inscricao = String(getRowVal(['Dt. Inscrição', 'Data Inscrição']) || '');

            const rawIngresso = getRowVal(['Processo de Ingresso', 'ingresso']) || '';
            let tipo_ingresso = '';
            const semesterMatch = String(rawIngresso).match(/(\d{4}[./-]\d{1,2})/);
            if (semesterMatch) {
                tipo_ingresso = semesterMatch[1].replace('.', '/').replace('-', '/');
            }

            // Check if exists
            const existing = await leadRepository.findByCpf(cpf);

            if (existing) {
                let notes = existing.notes || '';
                let statusChanged = 0;
                let anyDataChanged = false;

                const existingStatus = (existing.status || '').trim();
                const newStatus = String(status || '').trim();

                const existingPriority = STATUS_PRIORITY[existingStatus] || 0;
                const newPriority = STATUS_PRIORITY[newStatus] || 0;

                let finalStatus = existingStatus;

                if (newStatus !== '' && newPriority >= existingPriority) {
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
                    const date = new Date().toLocaleDateString('pt-BR');
                    notes = `${notes ? notes + '\n' : ''}[${date}] Importação ignorada: tentativa de alterar ${existingStatus} para ${newStatus} (prioridade menor)`;
                    anyDataChanged = true;
                    skippedDowngrades.push({ nome: String(nome || cpf), cpf, currentStatus: existingStatus, attemptedStatus: newStatus });
                    console.log(`[Import] Skipping status downgrade for CPF ${cpf}: ${existingStatus} (${existingPriority}) -> ${newStatus} (${newPriority})`);
                }

                if (anyDataChanged || statusChanged) {
                    const updateData: UpdateLeadDto = {
                        status: finalStatus,
                        tipo_ingresso: tipo_ingresso || undefined,
                        data_inscricao: data_inscricao || undefined,
                        notes,
                        is_new: 0,
                        status_changed: statusChanged,
                        status_changed_at: statusChanged ? new Date().toISOString() : undefined,
                        last_import_date: true
                    };

                    await leadRepository.update(cpf, updateData);
                    updated++;

                    if (statusChanged) {
                        try {
                            await activityService.logStatusChange(cpf, existingStatus, finalStatus);
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
                const existingByPhone = telefone
                    ? await leadRepository.findConflictingPhone(telefone, cpf)
                    : null;

                if (existingByPhone && telefone) {
                    // Merge by phone
                    const existingPriority = STATUS_PRIORITY[existingByPhone.status] || 0;
                    const newPriority = STATUS_PRIORITY[status] || 0;
                    const finalStatus = newPriority > existingPriority ? status : existingByPhone.status;
                    const isStatusChanged = existingByPhone.status !== finalStatus;

                    const date = new Date().toLocaleDateString('pt-BR');
                    const mergeNote = `[${date}] Merge automático: CPF ${cpf} mesclado (telefone duplicado)`;
                    const mergedNotes = existingByPhone.notes ? existingByPhone.notes + '\n' + mergeNote : mergeNote;

                    const updateData: UpdateLeadDto = {
                        nome: nome || undefined,
                        email: email || undefined,
                        status: finalStatus,
                        tipo_ingresso: tipo_ingresso || undefined,
                        data_inscricao: data_inscricao || undefined,
                        notes: mergedNotes,
                        is_new: 0,
                        status_changed: isStatusChanged ? 1 : undefined,
                        status_changed_at: isStatusChanged ? new Date().toISOString() : undefined,
                        last_import_date: true
                    };

                    await leadRepository.update(existingByPhone.cpf, updateData);
                    updated++;

                    if (isStatusChanged) {
                        try {
                            await activityService.logStatusChange(existingByPhone.cpf, existingByPhone.status, finalStatus);
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
                    const createData: CreateLeadDto = {
                        cpf,
                        nome,
                        email,
                        telefone,
                        tipo_ingresso,
                        status,
                        data_inscricao: data_inscricao || undefined,
                        notes: undefined
                    };

                    // We need to support is_new=1 and last_import_date=NOW() in create logic.
                    // The standard create logic sets defaults. Let's rely on standard create or update CreateDto.
                    // The current create method is slightly limited. 
                    // Let's assume standard create is fine, or we update newly created lead immediately if needed.
                    // For now, let's use standard create. The `is_new` logical logic might be default in DB?
                    // DB schema: is_new INTEGER DEFAULT 1. Perfect. last_import_date? NULL.
                    // We might miss last_import_date on create.
                    // TODO: Add last_import_date to CreateLeadDto if critical, but for now standard create is acceptable or I update repo create.

                    await leadRepository.create(createData);
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
            statusChanges,
            details: {
                createdLeads,
                updatedLeads,
                skippedDowngrades
            }
        });
    } catch (error) {
        return handleApiError(error);
    }
}
