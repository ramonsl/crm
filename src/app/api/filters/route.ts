import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
    try {
        const statusResult = await pool.query(
            'SELECT DISTINCT status FROM leads WHERE status IS NOT NULL ORDER BY status'
        );
        const statuses = statusResult.rows as { status: string }[];

        const semesterResult = await pool.query(
            'SELECT DISTINCT tipo_ingresso FROM leads WHERE tipo_ingresso IS NOT NULL'
        );
        const rawSemesters = semesterResult.rows as { tipo_ingresso: string }[];

        // Extract semesters using Regex (e.g., 2025/1, 2024.2)
        const semesterSet = new Set<string>();
        const semesterRegex = /(\d{4}[./-]\d{1,2})/;

        rawSemesters.forEach(item => {
            const match = item.tipo_ingresso.match(semesterRegex);
            if (match) {
                semesterSet.add(match[1].replace('.', '/').replace('-', '/'));
            }
        });

        const semesters = Array.from(semesterSet).sort().reverse();

        const courseResult = await pool.query(
            "SELECT DISTINCT curso_interesse FROM leads WHERE curso_interesse IS NOT NULL AND curso_interesse != '' ORDER BY curso_interesse"
        );
        const courses = courseResult.rows as { curso_interesse: string }[];

        return NextResponse.json({
            statuses: statuses.map(s => s.status),
            semesters: semesters,
            courses: courses.map(c => c.curso_interesse)
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
