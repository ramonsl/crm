import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { ActivityRepository } from '@/lib/repositories';
import { ActivityService } from '@/services/activityService';

// Initialize activity service for logging
const activityRepository = new ActivityRepository();
const activityService = new ActivityService(activityRepository);

interface MergeRequest {
    primaryCpf: string;
    secondaryCpfs: string[];
}

const STATUS_PRIORITY: Record<string, number> = {
    'NOVO': 1, 'LEAD': 2, 'EM_CONTATO': 3, 'INSCRITO': 4,
    'Inscrito Confirmado': 5, 'Aprovado': 6, 'APROVADO': 6,
    'Pagamento da Matrícula Iniciado': 7, 'Matricula Confirmada': 8, 'MATRICULADO': 8,
    'Reprovado': 0, 'REPROVADO': 0, 'Desistente': 0, 'DESISTENTE': 0,
};

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
        const primaryResult = await pool.query('SELECT * FROM leads WHERE cpf = $1', [primaryCpf]);
        const primary = primaryResult.rows[0];

        if (!primary) {
            return NextResponse.json(
                { error: 'Registro principal não encontrado' },
                { status: 404 }
            );
        }

        // Buscar registros secundários
        const secondaries = [];
        for (const cpf of secondaryCpfs) {
            const result = await pool.query('SELECT * FROM leads WHERE cpf = $1', [cpf]);
            if (result.rows[0]) {
                secondaries.push(result.rows[0]);
            }
        }

        if (secondaries.length === 0) {
            return NextResponse.json(
                { error: 'Nenhum registro secundário encontrado' },
                { status: 404 }
            );
        }

        // Execute merge in a transaction
        const client = await pool.connect();
        let mergedData: any;

        try {
            await client.query('BEGIN');

            mergedData = { ...primary };
            const date = new Date().toLocaleDateString('pt-BR');
            let mergeNotes = primary.notes || '';

            for (const secondary of secondaries) {
                // Preencher campos vazios
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

                if (secondary.notes) {
                    mergeNotes = mergeNotes ? mergeNotes + '\n' + secondary.notes : secondary.notes;
                }
                mergeNotes += `\n[${date}] Merge manual: CPF ${secondary.cpf} mesclado neste registro`;

                // Transferir mensagens
                await client.query(
                    'UPDATE messages SET contact_phone = $1 WHERE contact_phone = $2',
                    [primaryCpf, secondary.cpf]
                );

                // Deletar registro secundário
                await client.query('DELETE FROM leads WHERE cpf = $1', [secondary.cpf]);
            }

            // Atualizar registro principal
            await client.query(`
                UPDATE leads SET
                    nome = $1, email = $2, status = $3, tipo_ingresso = $4,
                    curso_interesse = $5, escola = $6, profile_image = $7,
                    notes = $8, updated_at = NOW()
                WHERE cpf = $9
            `, [
                mergedData.nome, mergedData.email, mergedData.status,
                mergedData.tipo_ingresso, mergedData.curso_interesse,
                mergedData.escola, mergedData.profile_image, mergeNotes, primaryCpf
            ]);

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        // Log atividade
        try {
            await activityService.logLeadUpdated(
                primaryCpf,
                { action: 'merge', mergedCpfs: secondaryCpfs, count: secondaryCpfs.length }
            );
        } catch (e) {
            console.error('[Merge] Error logging activity:', e);
        }

        return NextResponse.json({
            success: true,
            message: `${secondaryCpfs.length} registro(s) mesclado(s) com sucesso`,
            mergedRecord: mergedData
        });
    } catch (error) {
        console.error('[API /api/duplicates/merge POST] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
