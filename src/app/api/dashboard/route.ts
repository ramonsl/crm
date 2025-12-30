import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
    try {
        // Single optimized query using CTEs to get all dashboard data at once
        // Reduces from 6 queries to 1 query
        const result = await pool.query(`
            WITH 
            -- Total and status counts
            status_counts AS (
                SELECT 
                    status,
                    COUNT(*) as count
                FROM leads
                GROUP BY status
            ),
            -- Total leads count
            total_count AS (
                SELECT COUNT(*) as total FROM leads
            ),
            -- Meta matriculas from settings
            meta_data AS (
                SELECT COALESCE(value::integer, 0) as meta_matriculas
                FROM settings 
                WHERE key = 'meta_matriculas'
                LIMIT 1
            ),
            -- Forwarded leads count
            forwarded_data AS (
                SELECT COUNT(DISTINCT contact_cpf) as encaminhados_comercial
                FROM activities
                WHERE type = 'forwarded'
            ),
            -- Forwarded leads that became matriculated
            forwarded_matriculated AS (
                SELECT COUNT(DISTINCT a.contact_cpf) as encaminhados_matriculados
                FROM activities a
                INNER JOIN leads l ON a.contact_cpf = l.cpf
                WHERE a.type = 'forwarded'
                AND (
                    UPPER(l.status) = 'MATRICULADO' OR 
                    UPPER(l.status) = 'MATRICULA CONFIRMADA' OR 
                    UPPER(l.status) = 'MATRÍCULA CONFIRMADA'
                )
            ),
            -- Message counts
            message_counts AS (
                SELECT 
                    (SELECT COUNT(*) FROM messages WHERE from_me = true) as whatsapp_messages,
                    (SELECT COUNT(*) FROM template_history WHERE success = true) as templates_sent
            )
            -- Final aggregation
            SELECT 
                (SELECT total FROM total_count) as total,
                (SELECT meta_matriculas FROM meta_data) as meta_matriculas,
                (SELECT encaminhados_comercial FROM forwarded_data) as encaminhados_comercial,
                (SELECT encaminhados_matriculados FROM forwarded_matriculated) as encaminhados_matriculados,
                (SELECT whatsapp_messages FROM message_counts) as whatsapp_messages_sent,
                (SELECT templates_sent FROM message_counts) as templates_sent,
                COALESCE(json_agg(json_build_object('status', status, 'count', count)) FILTER (WHERE status IS NOT NULL), '[]'::json) as status_counts
            FROM status_counts
        `);

        const data = result.rows[0];
        const total = parseInt(data.total || '0');
        const metaMatriculas = parseInt(data.meta_matriculas || '0');
        const encaminhadosComercial = parseInt(data.encaminhados_comercial || '0');
        const encaminhadosMatriculados = parseInt(data.encaminhados_matriculados || '0');
        const whatsappMessagesSent = parseInt(data.whatsapp_messages_sent || '0');
        const templatesSent = parseInt(data.templates_sent || '0');
        const totalMessagesSent = whatsappMessagesSent + templatesSent;

        // Parse status counts from JSON aggregation
        const statusCounts = (data.status_counts || []) as { status: string; count: string }[];

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

        // Calculate conversion metrics
        const taxaConversaoComercial = encaminhadosComercial > 0
            ? ((encaminhadosMatriculados / encaminhadosComercial) * 100).toFixed(1)
            : '0.0';

        const leadInscritoSum = leadsCount + inscritosCount;
        const leadToMatriculaRatio = matriculados > 0 ? (leadInscritoSum / matriculados).toFixed(1) : '0.0';
        const inscritoToMatriculaRatio = matriculados > 0 ? (inscritosCount / matriculados).toFixed(1) : '0.0';

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
