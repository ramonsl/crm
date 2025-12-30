import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';

/**
 * Export API - Generate CSV for Google Contacts
 * 
 * Exports selected leads in Google Contacts CSV format with all 35 standard fields.
 * Receives CPFs via query string and returns a CSV file.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const cpfsParam = searchParams.get('cpfs');

        if (!cpfsParam) {
            return NextResponse.json({ error: 'CPFs parameter is required' }, { status: 400 });
        }

        // Parse CPFs (comma-separated)
        const cpfs = cpfsParam.split(',').map(cpf => cpf.trim()).filter(Boolean);

        if (cpfs.length === 0) {
            return NextResponse.json({ error: 'No valid CPFs provided' }, { status: 400 });
        }

        // Query database for selected leads
        const result = await pool.query(`
            SELECT 
                cpf, nome, telefone, email,
                escola, curso_interesse, tipo_ingresso,
                status, whatsapp_valido, last_message_time, notes
            FROM leads
            WHERE cpf = ANY($1)
            ORDER BY nome
        `, [cpfs]);

        const leads = result.rows;

        if (leads.length === 0) {
            return NextResponse.json({ error: 'No contacts found' }, { status: 404 });
        }

        // Load tags for all leads in a single query (optimized from N+1 to 1 query)
        const tagsMap = new Map<string, string>();

        if (leads.length > 0) {
            try {
                // Single query with JOIN to get all tags for all leads at once
                const tagsResult = await pool.query(`
                    SELECT lt.lead_cpf, t.name
                    FROM lead_tags lt
                    INNER JOIN tags t ON lt.tag_id = t.id
                    WHERE lt.lead_cpf = ANY($1)
                    ORDER BY lt.lead_cpf, t.name
                `, [cpfs]);

                // Group tags by CPF
                tagsResult.rows.forEach(row => {
                    const existing = tagsMap.get(row.lead_cpf) || '';
                    tagsMap.set(
                        row.lead_cpf,
                        existing ? `${existing}, ${row.name}` : row.name
                    );
                });
            } catch (error) {
                console.error('[API /api/export] Error loading tags:', error);
                // Continue with empty tags if query fails
            }
        }

        // Generate CSV content
        const csv = generateGoogleContactsCSV(leads, tagsMap);

        // Return CSV file with proper headers
        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="contatos.csv"`,
            },
        });
    } catch (error) {
        console.error('[API /api/export] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * Generate CSV in Google Contacts format
 * Includes all 35 standard fields required by Google Contacts
 */
function generateGoogleContactsCSV(leads: any[], tagsMap: Map<string, string>): string {
    // Google Contacts CSV header (35 fields)
    const header = [
        'Name Prefix',
        'First Name',
        'Middle Name',
        'Last Name',
        'Name Suffix',
        'Phonetic First Name',
        'Phonetic Middle Name',
        'Phonetic Last Name',
        'Nickname',
        'File As',
        'E-mail 1 - Label',
        'E-mail 1 - Value',
        'Phone 1 - Label',
        'Phone 1 - Value',
        'Address 1 - Label',
        'Address 1 - Country',
        'Address 1 - Street',
        'Address 1 - Extended Address',
        'Address 1 - City',
        'Address 1 - Region',
        'Address 1 - Postal Code',
        'Address 1 - PO Box',
        'Organization Name',
        'Organization Title',
        'Organization Department',
        'Birthday',
        'Event 1 - Label',
        'Event 1 - Value',
        'Relation 1 - Label',
        'Relation 1 - Value',
        'Website 1 - Label',
        'Website 1 - Value',
        'Custom Field 1 - Label',
        'Custom Field 1 - Value',
        'Notes',
        'Labels'
    ];

    // Build CSV rows
    const rows = leads.map(lead => {
        // Split name into parts
        const nameParts = (lead.nome || '').trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

        // Format phone with international code
        const phone = lead.telefone ? formatPhoneInternational(lead.telefone) : '';

        // Build Notes field
        const notes = buildNotesField(lead);

        // Get tags
        const labels = tagsMap.get(lead.cpf) || '';

        return [
            '', // Name Prefix
            escapeCSV(firstName),
            escapeCSV(middleName),
            escapeCSV(lastName),
            '', // Name Suffix
            '', // Phonetic First Name
            '', // Phonetic Middle Name
            '', // Phonetic Last Name
            '', // Nickname
            escapeCSV(lead.nome || ''), // File As
            'Work', // E-mail 1 - Label
            escapeCSV(lead.email || ''), // E-mail 1 - Value
            'Mobile', // Phone 1 - Label
            escapeCSV(phone), // Phone 1 - Value
            'Home', // Address 1 - Label
            'Brasil', // Address 1 - Country
            '', // Address 1 - Street (no address field)
            '', // Address 1 - Extended Address
            '', // Address 1 - City
            '', // Address 1 - Region
            '', // Address 1 - Postal Code
            '', // Address 1 - PO Box
            escapeCSV(lead.escola || ''), // Organization Name
            escapeCSV(lead.status || ''), // Organization Title
            escapeCSV(lead.curso_interesse || ''), // Organization Department
            '', // Birthday
            '', // Event 1 - Label
            '', // Event 1 - Value
            '', // Relation 1 - Label
            '', // Relation 1 - Value
            '', // Website 1 - Label
            '', // Website 1 - Value
            'Semestre', // Custom Field 1 - Label
            escapeCSV(lead.tipo_ingresso || ''), // Custom Field 1 - Value
            escapeCSV(notes), // Notes
            escapeCSV(labels) // Labels
        ];
    });

    // Combine header and rows into CSV
    const csvLines = [header, ...rows].map(row => row.join(',')).join('\n');

    // Add UTF-8 BOM for proper encoding in Excel/Google
    return '\uFEFF' + csvLines;
}

/**
 * Build Notes field with multiple information
 */
function buildNotesField(lead: any): string {
    const parts: string[] = [];

    if (lead.status) {
        parts.push(`Status: ${lead.status}`);
    }

    if (lead.curso_interesse) {
        parts.push(`Curso: ${lead.curso_interesse}`);
    }

    if (lead.tipo_ingresso) {
        parts.push(`Semestre: ${lead.tipo_ingresso}`);
    }

    if (lead.whatsapp_valido !== null && lead.whatsapp_valido !== undefined) {
        parts.push(`WhatsApp: ${lead.whatsapp_valido ? 'Sim' : 'Não'}`);
    }

    if (lead.last_message_time) {
        const date = new Date(lead.last_message_time);
        parts.push(`Última Mensagem: ${date.toLocaleString('pt-BR')}`);
    }

    if (lead.notes) {
        parts.push(`Observações: ${lead.notes}`);
    }

    return parts.join('\n');
}

/**
 * Format phone number with international code
 */
function formatPhoneInternational(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    // Add +55 if not present
    if (digits.startsWith('55')) {
        return '+' + digits;
    } else {
        return '+55' + digits;
    }
}

/**
 * Escape CSV field (handle commas and quotes)
 */
function escapeCSV(value: string): string {
    if (!value) return '';

    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return '"' + value.replace(/"/g, '""') + '"';
    }

    return value;
}
