import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { ActivityRepository } from '@/lib/repositories';
import { ActivityService } from '@/services/activityService';

// Initialize activity service for logging
const activityRepository = new ActivityRepository(db);
const activityService = new ActivityService(activityRepository);

interface MergeRequest {
    primaryCpf: string;      // CPF do registro que será mantido
    secondaryCpfs: string[]; // CPFs dos registros que serão mesclados e deletados
}

/**
 * Prioridade dos status (maior = mais avançado)
 */
const STATUS_PRIORITY: Record<string, number> = {
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

/**
 * POST /api/duplicates/merge
 * Mescla registros duplicados em um único registro
 */
export async function POST(req: NextRequest) {
    try {
        const body: MergeRequest = await req.json();
        const { primaryCpf, secondaryCpfs } = body;

        if (!primaryCpf || !secondaryCpfs || secondaryCpfs.length === 0) {
            return NextResponse.json(
                { error: 'primaryCpf e secondaryCpfs são obrigatórios' },
                { status: 400 }
            );
        }

        // Buscar registro principal
        console.log('[Merge API] Buscando primaryCpf:', primaryCpf);
        const primary = db.prepare('SELECT * FROM leads WHERE cpf = ?').get(primaryCpf) as any;
        console.log('[Merge API] Primary encontrado:', primary ? 'sim' : 'não');

        if (!primary) {
            return NextResponse.json(
                { error: 'Registro principal não encontrado' },
                { status: 404 }
            );
        }

        // Buscar registros secundários
        console.log('[Merge API] Buscando secondaryCpfs:', secondaryCpfs);
        const secondaries = secondaryCpfs.map(cpf => {
            const found = db.prepare('SELECT * FROM leads WHERE cpf = ?').get(cpf) as any;
            console.log(`[Merge API] Secundário ${cpf}:`, found ? 'encontrado' : 'não encontrado');
            return found;
        }).filter(Boolean);

        console.log('[Merge API] Total secundários encontrados:', secondaries.length);

        if (secondaries.length === 0) {
            return NextResponse.json(
                { error: 'Nenhum registro secundário encontrado' },
                { status: 404 }
            );
        }

        const transaction = db.transaction(() => {
            let mergedData = { ...primary };
            const date = new Date().toLocaleDateString('pt-BR');
            let mergeNotes = primary.notes || '';

            // Mesclar dados de cada registro secundário
            for (const secondary of secondaries) {
                // Preencher campos vazios do principal com dados do secundário
                if (!mergedData.nome && secondary.nome) mergedData.nome = secondary.nome;
                if (!mergedData.email && secondary.email) mergedData.email = secondary.email;
                if (!mergedData.telefone && secondary.telefone) mergedData.telefone = secondary.telefone;
                if (!mergedData.tipo_ingresso && secondary.tipo_ingresso) mergedData.tipo_ingresso = secondary.tipo_ingresso;
                if (!mergedData.curso_interesse && secondary.curso_interesse) mergedData.curso_interesse = secondary.curso_interesse;
                if (!mergedData.escola && secondary.escola) mergedData.escola = secondary.escola;
                if (!mergedData.profile_image && secondary.profile_image) mergedData.profile_image = secondary.profile_image;

                // Usar status mais avançado
                const primaryPriority = STATUS_PRIORITY[mergedData.status] || 0;
                const secondaryPriority = STATUS_PRIORITY[secondary.status] || 0;
                if (secondaryPriority > primaryPriority) {
                    mergedData.status = secondary.status;
                }

                // Acumular notas
                if (secondary.notes) {
                    mergeNotes = mergeNotes ? mergeNotes + '\n' + secondary.notes : secondary.notes;
                }

                // Adicionar nota sobre o merge
                mergeNotes += `\n[${date}] Merge manual: CPF ${secondary.cpf} mesclado neste registro`;

                // Transferir mensagens do secundário para o principal
                db.prepare(`
                    UPDATE messages SET contact_cpf = ? WHERE contact_cpf = ?
                `).run(primaryCpf, secondary.cpf);

                // Transferir histórico de mensagens
                db.prepare(`
                    UPDATE message_history SET contact_cpf = ? WHERE contact_cpf = ?
                `).run(primaryCpf, secondary.cpf);

                // Deletar registro secundário
                db.prepare('DELETE FROM leads WHERE cpf = ?').run(secondary.cpf);
            }

            // Atualizar registro principal com dados mesclados
            db.prepare(`
                UPDATE leads SET
                    nome = ?,
                    email = ?,
                    status = ?,
                    tipo_ingresso = ?,
                    curso_interesse = ?,
                    escola = ?,
                    profile_image = ?,
                    notes = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE cpf = ?
            `).run(
                mergedData.nome,
                mergedData.email,
                mergedData.status,
                mergedData.tipo_ingresso,
                mergedData.curso_interesse,
                mergedData.escola,
                mergedData.profile_image,
                mergeNotes,
                primaryCpf
            );

            return mergedData;
        });

        const result = transaction();

        // Log atividade de merge
        try {
            activityService.logLeadUpdated(
                primaryCpf,
                { action: 'merge', mergedCpfs: secondaryCpfs, count: secondaryCpfs.length }
            );
        } catch (e) {
            console.error('[Merge] Error logging activity:', e);
        }

        return NextResponse.json({
            success: true,
            message: `${secondaryCpfs.length} registro(s) mesclado(s) com sucesso`,
            mergedRecord: result
        });
    } catch (error) {
        console.error('[API /api/duplicates/merge POST] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
