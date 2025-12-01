import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { normalizePhone } from '@/lib/utils';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || '';
        const semester = searchParams.get('semester') || '';
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM leads WHERE 1=1';
        const params: any[] = [];

        if (search) {
            query += ' AND (nome LIKE ? OR email LIKE ? OR cpf LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term);
        }

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

        if (semester) {
            const semesters = semester.split(',');
            if (semesters.length > 0) {
                const conditions = semesters.map(() => 'tipo_ingresso LIKE ?').join(' OR ');
                query += ` AND (${conditions})`;
                semesters.forEach(s => params.push(`%${s.trim()}%`));
            }
        }

        const course = searchParams.get('course') || '';
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
            const now = new Date();
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
        query += ` ORDER BY ${validSortBy} ${validSortOrder} LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const leads = db.prepare(query).all(...params);

        return NextResponse.json({
            data: leads,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error(error);
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

        const stmt = db.prepare(`
            INSERT INTO leads (nome, email, telefone, cpf, status, tipo_ingresso)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(nome, email, normalizePhone(telefone), cpf, status || 'NOVO', tipo_ingresso);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error(error);
        if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
            return NextResponse.json({ error: 'CPF already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        console.log('PUT /api/leads received body:', body);
        const { nome, email, telefone, cpf, status, tipo_ingresso, curso_interesse, escola, originalCpf } = body;

        if (!nome || !telefone || !cpf) {
            console.log('Missing required fields:', { nome, telefone, cpf });
            return NextResponse.json({ error: 'Name, Phone and CPF are required' }, { status: 400 });
        }

        // If originalCpf is provided, we are updating the PK as well, or just updating based on it
        const targetCpf = originalCpf || cpf;
        console.log('Target CPF:', targetCpf);

        // If CPF is changing, we need to handle it carefully due to FK constraints
        if (originalCpf && originalCpf !== cpf) {
            console.log('CPF is changing from', originalCpf, 'to', cpf);
            // Check if new CPF already exists
            const existing = db.prepare('SELECT cpf FROM leads WHERE cpf = ?').get(cpf);
            if (existing) {
                console.log('New CPF already exists');
                return NextResponse.json({ error: 'CPF already exists' }, { status: 409 });
            }

            // Transaction approach
            const transaction = db.transaction(() => {
                // 1. Create new lead with new CPF
                const insert = db.prepare(`
                    INSERT INTO leads (nome, email, telefone, cpf, status, tipo_ingresso, curso_interesse, escola, created_at, updated_at, last_message, unread_count, last_message_time, profile_image)
                    SELECT ?, ?, ?, ?, ?, ?, ?, ?, created_at, CURRENT_TIMESTAMP, last_message, unread_count, last_message_time, profile_image
                    FROM leads WHERE cpf = ?
                `);
                insert.run(nome, email, normalizePhone(telefone), cpf, status, tipo_ingresso, curso_interesse, escola, originalCpf);

                // 2. Move messages to new lead
                const updateMessages = db.prepare('UPDATE messages SET contact_cpf = ? WHERE contact_cpf = ?');
                updateMessages.run(cpf, originalCpf);

                // 3. Delete old lead
                const deleteOld = db.prepare('DELETE FROM leads WHERE cpf = ?');
                deleteOld.run(originalCpf);
            });

            transaction();
            return NextResponse.json({ success: true });
        }

        const stmt = db.prepare(`
            UPDATE leads 
            SET nome = ?, email = ?, telefone = ?, cpf = ?, status = ?, tipo_ingresso = ?, curso_interesse = ?, escola = ?, updated_at = CURRENT_TIMESTAMP
            WHERE cpf = ?
        `);

        const normalizedPhone = normalizePhone(telefone);
        console.log('Updating lead:', { nome, email, normalizedPhone, cpf, status, tipo_ingresso, curso_interesse, escola, targetCpf });

        const result = stmt.run(nome, email, normalizedPhone, cpf, status, tipo_ingresso, curso_interesse, escola, targetCpf);
        console.log('Update result:', result);

        if (result.changes === 0) {
            console.log('No changes made (Contact not found?)');
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('PUT /api/leads error:', error);
        if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
            return NextResponse.json({ error: 'CPF already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const cpf = searchParams.get('cpf');
        const all = searchParams.get('all');

        if (all === 'true') {
            const stmt = db.prepare('DELETE FROM leads');
            stmt.run();
            return NextResponse.json({ success: true, message: 'All contacts deleted' });
        }

        if (!cpf) {
            return NextResponse.json({ error: 'CPF is required' }, { status: 400 });
        }

        const stmt = db.prepare('DELETE FROM leads WHERE cpf = ?');
        const result = stmt.run(cpf);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
