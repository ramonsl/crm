import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        // Total leads
        const total = (db.prepare('SELECT COUNT(*) as count FROM leads').get() as any).count;

        // Count by status
        const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM leads 
      GROUP BY status
    `).all() as { status: string; count: number }[];

        // Funnel Calculation
        // Assuming a linear progression: Total -> Inscrito -> Aprovado -> Matriculado
        // However, status is usually current state.
        // So we can aggregate:
        // Top of funnel (Total Leads) = All leads
        // Middle (Qualified/Approved) = Aprovado + Matriculado
        // Bottom (Converted) = Matriculado

        // Fetch Meta
        const metaSetting = db.prepare("SELECT value FROM settings WHERE key = 'meta_matriculas'").get() as { value: string };
        const metaMatriculas = metaSetting ? Number(metaSetting.value) : 0;

        const inscritosCount = statusCounts.reduce((acc, s) => {
            const status = s.status?.toUpperCase() || '';
            if (status.includes('INSCRITO')) return acc + s.count;
            return acc;
        }, 0);

        const leadsCount = statusCounts.reduce((acc, s) => {
            const status = s.status?.toUpperCase() || '';
            if (status === 'LEAD' || status === 'NOVO') return acc + s.count;
            return acc;
        }, 0);

        const matriculados = statusCounts.reduce((acc, s) => {
            const status = s.status?.toUpperCase() || '';
            if (status === 'MATRICULADO' || status === 'MATRICULA CONFIRMADA' || status === 'MATRÍCULA CONFIRMADA') {
                return acc + s.count;
            }
            return acc;
        }, 0);

        const aprovados = statusCounts.find(s => s.status?.toUpperCase() === 'APROVADO')?.count || 0;

        // Indicators
        // 1. Lead + Inscritos / Matricula Confirmada
        const leadInscritoSum = leadsCount + inscritosCount;
        const leadToMatriculaRatio = matriculados > 0 ? (leadInscritoSum / matriculados).toFixed(1) : '0.0';

        // 2. Inscritos / Matricula Confirmada
        const inscritoToMatriculaRatio = matriculados > 0 ? (inscritosCount / matriculados).toFixed(1) : '0.0';

        // Construct funnel data
        // Step 1: Todos (Total)
        // Step 2: Inscritos (Inscritos + Aprovados + Matriculados - assuming progression)
        // Step 3: Aprovados (Aprovados + Matriculados - assuming matriculados were approved)
        // Step 4: Matriculados

        const funnel = [
            { label: 'Total de Leads', value: total, color: '#3b82f6' },
            { label: 'Inscritos', value: inscritosCount + aprovados + matriculados, color: '#8b5cf6' },
            { label: 'Aprovados', value: aprovados + matriculados, color: '#f59e0b' },
            { label: 'Matriculados', value: matriculados, color: '#10b981' }
        ];

        const conversionRate = total > 0 ? ((matriculados / total) * 100).toFixed(1) : '0.0';

        return NextResponse.json({
            total,
            statusCounts,
            funnel,
            conversionRate,
            metaMatriculas,
            leadToMatriculaRatio,
            inscritoToMatriculaRatio,
            matriculados // sending explicit count for easier frontend use
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
