import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
    try {
        // Total leads
        const totalResult = await pool.query('SELECT COUNT(*) as count FROM leads');
        const total = parseInt(totalResult.rows[0].count);

        // Count by status
        const statusResult = await pool.query(`
            SELECT status, COUNT(*) as count 
            FROM leads 
            GROUP BY status
        `);
        const statusCounts = statusResult.rows as { status: string; count: string }[];

        // Fetch Meta
        const metaResult = await pool.query("SELECT value FROM settings WHERE key = 'meta_matriculas'");
        const metaMatriculas = metaResult.rows[0] ? Number(metaResult.rows[0].value) : 0;

        const inscritosCount = statusCounts.reduce((acc, s) => {
            const status = s.status?.toUpperCase() || '';
            if (status.includes('INSCRITO')) return acc + parseInt(s.count);
            return acc;
        }, 0);

        const leadsCount = statusCounts.reduce((acc, s) => {
            const status = s.status?.toUpperCase() || '';
            if (status === 'LEAD' || status === 'NOVO') return acc + parseInt(s.count);
            return acc;
        }, 0);

        const matriculados = statusCounts.reduce((acc, s) => {
            const status = s.status?.toUpperCase() || '';
            if (status === 'MATRICULADO' || status === 'MATRICULA CONFIRMADA' || status === 'MATRÍCULA CONFIRMADA') {
                return acc + parseInt(s.count);
            }
            return acc;
        }, 0);

        const aprovados = parseInt(statusCounts.find(s => s.status?.toUpperCase() === 'APROVADO')?.count || '0');

        // === Encaminhados ao Comercial ===
        const encaminhadosResult = await pool.query(`
            SELECT COUNT(DISTINCT contact_cpf) as count 
            FROM activities 
            WHERE type = 'forwarded'
        `);
        const encaminhadosComercial = parseInt(encaminhadosResult.rows[0]?.count || '0');

        // === Encaminhados que viraram Matrícula Confirmada ===
        const encaminhadosMatriculadosResult = await pool.query(`
            SELECT COUNT(DISTINCT a.contact_cpf) as count 
            FROM activities a
            INNER JOIN leads l ON a.contact_cpf = l.cpf
            WHERE a.type = 'forwarded'
            AND (
                UPPER(l.status) = 'MATRICULADO' OR 
                UPPER(l.status) = 'MATRICULA CONFIRMADA' OR 
                UPPER(l.status) = 'MATRÍCULA CONFIRMADA'
            )
        `);
        const encaminhadosMatriculados = parseInt(encaminhadosMatriculadosResult.rows[0]?.count || '0');

        // Taxa de conversão comercial
        const taxaConversaoComercial = encaminhadosComercial > 0
            ? ((encaminhadosMatriculados / encaminhadosComercial) * 100).toFixed(1)
            : '0.0';

        // Indicators
        const leadInscritoSum = leadsCount + inscritosCount;
        const leadToMatriculaRatio = matriculados > 0 ? (leadInscritoSum / matriculados).toFixed(1) : '0.0';
        const inscritoToMatriculaRatio = matriculados > 0 ? (inscritosCount / matriculados).toFixed(1) : '0.0';

        // === Total de Mensagens Enviadas ===
        // Conta mensagens do WhatsApp (from_me = true) + templates enviados
        const messagesResult = await pool.query(`
            SELECT COUNT(*) as count FROM messages WHERE from_me = true
        `);
        const whatsappMessagesSent = parseInt(messagesResult.rows[0]?.count || '0');

        const templatesResult = await pool.query(`
            SELECT COUNT(*) as count FROM template_history WHERE success = true
        `);
        const templatesSent = parseInt(templatesResult.rows[0]?.count || '0');

        const totalMessagesSent = whatsappMessagesSent + templatesSent;

        // Construct funnel data
        const funnel = [
            { label: 'Total de Leads', value: total, color: '#3b82f6' },
            { label: 'Inscritos', value: inscritosCount + aprovados + matriculados, color: '#8b5cf6' },
            { label: 'Aprovados', value: aprovados + matriculados, color: '#f59e0b' },
            { label: 'Matriculados', value: matriculados, color: '#10b981' }
        ];

        const conversionRate = total > 0 ? ((matriculados / total) * 100).toFixed(1) : '0.0';

        return NextResponse.json({
            total,
            statusCounts: statusCounts.map(s => ({ ...s, count: parseInt(s.count) })),
            funnel,
            conversionRate,
            metaMatriculas,
            leadToMatriculaRatio,
            inscritoToMatriculaRatio,
            matriculados,
            encaminhadosComercial,
            encaminhadosMatriculados,
            taxaConversaoComercial,
            totalMessagesSent,
            whatsappMessagesSent,
            templatesSent
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
