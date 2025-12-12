import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { removeNonDigits } from '@/lib/utils/phoneUtils';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || '';

        // Build query based on status filter
        let query = 'SELECT * FROM leads WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            const statuses = status.split(',');
            if (statuses.length > 0) {
                const conditions = statuses.map(() => `status = $${paramIndex++}`).join(' OR ');
                query += ` AND (${conditions})`;
                statuses.forEach(s => params.push(s.trim()));
            }
        }

        // Exclude specific statuses
        const excludeStatus = searchParams.get('exclude_status');
        if (excludeStatus) {
            const excluded = excludeStatus.split(',');
            if (excluded.length > 0) {
                const conditions = excluded.map(() => `status != $${paramIndex++}`).join(' AND ');
                query += ` AND (${conditions})`;
                excluded.forEach(s => params.push(s.trim()));
            }
        }

        query += ' ORDER BY nome ASC';

        const result = await pool.query(query, params);
        const leads = result.rows;

        // Google Contacts CSV headers
        const headers = [
            'Name Prefix', 'First Name', 'Middle Name', 'Last Name', 'Name Suffix',
            'Phonetic First Name', 'Phonetic Middle Name', 'Phonetic Last Name',
            'Nickname', 'File As',
            'E-mail 1 - Label', 'E-mail 1 - Value',
            'Phone 1 - Label', 'Phone 1 - Value',
            'Address 1 - Label', 'Address 1 - Country', 'Address 1 - Street',
            'Address 1 - Extended Address', 'Address 1 - City', 'Address 1 - Region',
            'Address 1 - Postal Code', 'Address 1 - PO Box',
            'Organization Name', 'Organization Title', 'Organization Department',
            'Birthday',
            'Event 1 - Label', 'Event 1 - Value',
            'Relation 1 - Label', 'Relation 1 - Value',
            'Website 1 - Label', 'Website 1 - Value',
            'Custom Field 1 - Label', 'Custom Field 1 - Value',
            'Notes', 'Labels'
        ];

        // Helper function to escape CSV values
        const escapeCsv = (value: any): string => {
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        // Helper to split name into parts
        const splitName = (fullName: string) => {
            const parts = fullName.trim().split(' ');
            if (parts.length === 1) {
                return { firstName: parts[0], lastName: '' };
            }
            const firstName = parts[0];
            const lastName = parts.slice(1).join(' ');
            return { firstName, lastName };
        };

        // Format phone number for Google
        const formatPhone = (phone: string): string => {
            if (!phone) return '';
            const digits = removeNonDigits(phone);
            if (digits.length === 10 || digits.length === 11) {
                return `+55 ${digits}`;
            }
            if (digits.length > 11) {
                return `+${digits}`;
            }
            return digits;
        };

        // Build CSV rows
        const rows = leads.map(lead => {
            const { firstName, lastName } = splitName(lead.nome || '');
            const formattedPhone = formatPhone(lead.telefone || '');

            let notes = lead.notes || '';
            if (lead.curso_interesse) {
                notes += (notes ? '\n' : '') + `Curso de Interesse: ${lead.curso_interesse}`;
            }
            if (lead.escola) {
                notes += (notes ? '\n' : '') + `Escola: ${lead.escola}`;
            }
            if (lead.tipo_ingresso) {
                notes += (notes ? '\n' : '') + `Semestre: ${lead.tipo_ingresso}`;
            }
            if (lead.cpf) {
                notes += (notes ? '\n' : '') + `CPF: ${lead.cpf}`;
            }

            return [
                '', escapeCsv(firstName), '', escapeCsv(lastName), '',
                '', '', '', '', '',
                'Email', escapeCsv(lead.email || ''),
                'Mobile', escapeCsv(formattedPhone),
                '', '', '', '', '', '', '', '',
                'ULBRA', '', escapeCsv(lead.curso_interesse || ''),
                '', '', '', '', '', '', '',
                'Status', escapeCsv(lead.status || ''),
                escapeCsv(notes), 'CRM'
            ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="contatos-crm-${new Date().toISOString().split('T')[0]}.csv"`,
            },
        });
    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
