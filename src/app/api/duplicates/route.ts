import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

interface DuplicateGroup {
    telefone: string;
    registros: Array<{
        cpf: string;
        nome: string;
        email: string | null;
        status: string;
        tipo_ingresso: string | null;
        created_at: string;
        updated_at: string;
    }>;
}

/**
 * GET /api/duplicates
 * Lista todos os telefones que aparecem em mais de um registro (potenciais duplicatas)
 */
export async function GET() {
    try {
        // Encontrar telefones duplicados
        const duplicateResult = await pool.query(`
            SELECT telefone, COUNT(*) as count
            FROM leads
            WHERE telefone IS NOT NULL AND telefone != ''
            GROUP BY telefone
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        `);
        const duplicatePhones = duplicateResult.rows as Array<{ telefone: string; count: string }>;

        if (duplicatePhones.length === 0) {
            return NextResponse.json({
                duplicates: [],
                totalGroups: 0,
                totalRecords: 0,
                message: 'Nenhuma duplicata encontrada'
            });
        }

        // Buscar detalhes de cada grupo de duplicatas
        const groups: DuplicateGroup[] = [];

        for (const { telefone } of duplicatePhones) {
            const registrosResult = await pool.query(`
                SELECT cpf, nome, email, status, tipo_ingresso, created_at, updated_at
                FROM leads
                WHERE telefone = $1
                ORDER BY updated_at DESC
            `, [telefone]);

            groups.push({
                telefone,
                registros: registrosResult.rows
            });
        }

        const totalRecords = groups.reduce((acc, g) => acc + g.registros.length, 0);

        return NextResponse.json({
            duplicates: groups,
            totalGroups: groups.length,
            totalRecords,
            message: `Encontrados ${groups.length} grupos de duplicatas (${totalRecords} registros)`
        });
    } catch (error) {
        console.error('[API /api/duplicates GET] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
