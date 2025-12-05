import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { LeadRepository } from '@/lib/repositories';
import { normalizePhone } from '@/lib/utils';
import type { LeadFilters, CreateLeadDto, UpdateLeadDto } from '@/lib/repositories';

// Initialize repository
const leadRepository = new LeadRepository(db);

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        // Build filters from query params
        const filters: LeadFilters & Record<string, any> = {
            page: parseInt(searchParams.get('page') || '1'),
            pageSize: parseInt(searchParams.get('limit') || '10'),
            search: searchParams.get('search') || undefined,
            status: searchParams.get('status') || undefined,
        };

        // Complex query building for features not yet in repository
        // TODO: Move this logic to repository methods
        let query = 'SELECT * FROM leads WHERE 1=1';
        const params: any[] = [];

        if (filters.search) {
            query += ' AND (nome LIKE ? OR email LIKE ? OR cpf LIKE ?)';
            const term = `%${filters.search}%`;
            params.push(term, term, term);
        }

        const status = searchParams.get('status');
        if (status && status !== 'all') {
            const statuses = status.split(',');
            if (statuses.length > 0) {
                const conditions = statuses.map(() => 'status = ?').join(' OR ');
                query += ` AND (${conditions})`;
                statuses.forEach(s => params.push(s.trim()));
            }
        }

        const excludeStatus = searchParams.get('exclude_status');
        if (excludeStatus) {
            const excluded = excludeStatus.split(',');
            if (excluded.length > 0) {
                const conditions = excluded.map(() => 'status != ?').join(' AND ');
                query += ` AND (${conditions})`;
                excluded.forEach(s => params.push(s.trim()));
            }
        }

        const semester = searchParams.get('semester');
        if (semester) {
            const semesters = semester.split(',');
            if (semesters.length > 0) {
                const conditions = semesters.map(() => 'tipo_ingresso LIKE ?').join(' OR ');
                query += ` AND (${conditions})`;
                semesters.forEach(s => params.push(`%${s.trim()}%`));
            }
        }

        const course = searchParams.get('course');
        if (course) {
            const courses = course.split(',');
            if (courses.length > 0) {
                const conditions = courses.map(() => 'curso_interesse LIKE ?').join(' OR ');
                query += ` AND (${conditions})`;
                courses.forEach(s => params.push(`%${s.trim()}%`));
            }
        }

        const excludeExistingPhones = searchParams.get('exclude_existing_phones');
        if (excludeExistingPhones === 'true') {
            query += ` AND telefone NOT IN (SELECT telefone FROM leads WHERE status != 'LEAD')`;
        }

        const lastMessagePeriod = searchParams.get('last_message_period');
        if (lastMessagePeriod) {
            if (lastMessagePeriod === '1h') {
                query += " AND last_message_time >= datetime('now', '-1 hour', 'localtime')";
            } else if (lastMessagePeriod === 'today') {
                query += " AND last_message_time >= datetime('now', '-24 hours', 'localtime')";
            } else if (lastMessagePeriod === '1-3d') {
                query += " AND last_message_time >= datetime('now', '-3 days', 'localtime') AND last_message_time < datetime('now', '-1 day', 'localtime')";
            } else if (lastMessagePeriod === '3-7d') {
                query += " AND last_message_time >= datetime('now', '-7 days', 'localtime') AND last_message_time < datetime('now', '-3 days', 'localtime')";
            } else if (lastMessagePeriod === '7-15d') {
                query += " AND last_message_time >= datetime('now', '-15 days', 'localtime') AND last_message_time < datetime('now', '-7 days', 'localtime')";
            } else if (lastMessagePeriod === '15d+') {
                query += " AND last_message_time < datetime('now', '-15 days', 'localtime') AND last_message_time IS NOT NULL";
            } else if (lastMessagePeriod === 'never') {
                query += " AND last_message_time IS NULL";
            }
        }

        const isNew = searchParams.get('is_new');
        if (isNew === '1') {
            query += ' AND is_new = 1';
        }

        const statusChanged = searchParams.get('status_changed');
        if (statusChanged === '1') {
            query += ' AND status_changed = 1';
        }

        // Get total count for pagination
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        const totalResult = db.prepare(countQuery).get(...params) as { total: number };
        const total = totalResult.total;

        // Sorting
        const sortBy = searchParams.get('sort_by') || 'updated_at';
        const sortOrder = (searchParams.get('sort_order') || 'desc').toUpperCase();

        const allowedColumns = ['nome', 'email', 'telefone', 'cpf', 'status', 'tipo_ingresso', 'curso_interesse', 'escola', 'created_at', 'updated_at', 'last_message_time'];
        const validSortBy = allowedColumns.includes(sortBy) ? sortBy : 'updated_at';
        const validSortOrder = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';

        // Get data
        const offset = (filters.page! - 1) * filters.pageSize!;
        query += ` ORDER BY ${validSortBy} ${validSortOrder} LIMIT ? OFFSET ?`;
        params.push(filters.pageSize, offset);

        const leads = db.prepare(query).all(...params);

        return NextResponse.json({
            data: leads,
            pagination: {
                total,
                page: filters.page,
                limit: filters.pageSize,
                totalPages: Math.ceil(total / filters.pageSize!)
            }
        });
    } catch (error) {
        console.error('[API /api/leads GET] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { nome, email, telefone, cpf, status, tipo_ingresso } = body;

        if (!nome || !telefone) {
            return NextResponse.json({ error: 'Name and Phone are required' }, { status: 400 });
        }

        const normalizedPhone = normalizePhone(telefone);

        // Use repository to create lead
        // If CPF is empty, use phone as CPF (since CPF is PRIMARY KEY)
        const leadData: CreateLeadDto = {
            cpf: cpf && cpf.trim() !== '' ? cpf : normalizedPhone,
            nome,
            telefone: normalizedPhone,
            email,
            status: status || 'NOVO',
            tipo_ingresso,
        };

        const createdLead = leadRepository.create(leadData);
        console.log('[API /api/leads POST] Lead created successfully:', createdLead.id);

        return NextResponse.json({ success: true, data: createdLead });
    } catch (error: unknown) {
        console.error('[API /api/leads POST] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('UNIQUE constraint failed')) {
            return NextResponse.json({ error: 'CPF or telefone already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        console.log('[API /api/leads PUT] Received body:', body);
        const { nome, email, telefone, cpf, status, tipo_ingresso, curso_interesse, escola, originalCpf } = body;

        if (!nome || !telefone || !cpf) {
            console.log('[API /api/leads PUT] Missing required fields:', { nome, telefone, cpf });
            return NextResponse.json({ error: 'Name, Phone and CPF are required' }, { status: 400 });
        }

        const targetCpf = originalCpf || cpf;
        console.log('[API /api/leads PUT] Target CPF:', targetCpf);

        // If CPF is changing, handle FK constraints
        if (originalCpf && originalCpf !== cpf) {
            console.log('[API /api/leads PUT] CPF changing from', originalCpf, 'to', cpf);

            // Check if new CPF already exists
            const existing = leadRepository.findByCpf(cpf);
            if (existing) {
                console.log('[API /api/leads PUT] New CPF already exists');
                return NextResponse.json({ error: 'CPF already exists' }, { status: 409 });
            }

            // Transaction approach (still using direct DB for complex transaction)
            const transaction = db.transaction(() => {
                const insert = db.prepare(`
                    INSERT INTO leads (nome, email, telefone, cpf, status, tipo_ingresso, curso_interesse, escola, created_at, updated_at, last_message, unread_count, last_message_time, profile_image)
                    SELECT ?, ?, ?, ?, ?, ?, ?, ?, created_at, CURRENT_TIMESTAMP, last_message, unread_count, last_message_time, profile_image
                    FROM leads WHERE cpf = ?
                `);
                insert.run(nome, email, normalizePhone(telefone), cpf, status, tipo_ingresso, curso_interesse, escola, originalCpf);

                const updateMessages = db.prepare('UPDATE messages SET contact_cpf = ? WHERE contact_cpf = ?');
                updateMessages.run(cpf, originalCpf);

                const deleteOld = db.prepare('DELETE FROM leads WHERE cpf = ?');
                deleteOld.run(originalCpf);
            });

            transaction();
            return NextResponse.json({ success: true });
        }

        // Find lead by CPF to get ID
        const lead = leadRepository.findByCpf(targetCpf);
        if (!lead) {
            console.log('[API /api/leads PUT] Lead not found');
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        // Use repository to update
        const updateData: UpdateLeadDto = {
            nome,
            email: email || undefined,  // Convert empty string to undefined
            telefone: normalizePhone(telefone),
            status,
            curso_interesse: curso_interesse || undefined,
            escola: escola || undefined,
            tipo_ingresso: tipo_ingresso || undefined,
        };

        console.log('[API /api/leads PUT] Update data:', updateData);

        leadRepository.update(targetCpf, updateData);
        console.log('[API /api/leads PUT] Lead updated successfully');

        // Return updated lead
        const updatedLead = leadRepository.findByCpf(targetCpf);
        return NextResponse.json({ success: true, data: updatedLead });
    } catch (error: unknown) {
        console.error('[API /api/leads PUT] Error:', error);
        if (error instanceof Error) {
            console.error('[API /api/leads PUT] Error message:', error.message);
            console.error('[API /api/leads PUT] Error stack:', error.stack);
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('UNIQUE constraint failed')) {
            return NextResponse.json({ error: 'CPF already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const cpf = searchParams.get('cpf');
        const telefone = searchParams.get('telefone');
        const all = searchParams.get('all');

        if (all === 'true') {
            // Direct DB for bulk delete (not common operation)
            const stmt = db.prepare('DELETE FROM leads');
            stmt.run();
            return NextResponse.json({ success: true, message: 'All contacts deleted' });
        }

        // Need either CPF or telefone
        if (!cpf && !telefone) {
            return NextResponse.json({ error: 'CPF or telefone is required' }, { status: 400 });
        }

        let lead: any;

        // Try to find by CPF first, then by telefone
        if (cpf) {
            lead = leadRepository.findByCpf(cpf);
        } else if (telefone) {
            // Find by telefone
            const stmt = db.prepare('SELECT * FROM leads WHERE telefone = ?');
            lead = stmt.get(telefone);
        }

        if (!lead) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        // Delete using CPF (primary key)
        leadRepository.delete(lead.cpf);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API /api/leads DELETE] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
