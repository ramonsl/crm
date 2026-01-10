import { NextResponse, NextRequest } from 'next/server';
import { pool, query, queryOne } from '@/lib/db';
import { LeadRepository, ActivityRepository } from '@/lib/repositories';
import { normalizePhone } from '@/lib/utils';
import type { LeadFilters, CreateLeadDto, UpdateLeadDto } from '@/lib/repositories';
import { ActivityService } from '@/services/activityService';
import { statusMessageService } from '@/services/StatusMessageService';
import { requireAuth, UnauthorizedError } from '@/lib/auth/requireAuth';

// Initialize repositories and services
const leadRepository = new LeadRepository();
const activityRepository = new ActivityRepository();
const activityService = new ActivityService(activityRepository);

export async function GET(req: NextRequest) {
    try {
        // Require authentication
        await requireAuth(req);

        const { searchParams } = new URL(req.url);

        // Build filters from query params
        const filters: LeadFilters & Record<string, any> = {
            page: parseInt(searchParams.get('page') || '1'),
            pageSize: parseInt(searchParams.get('limit') || '10'),
            search: searchParams.get('search') || undefined,
            status: searchParams.get('status') || undefined,
        };

        // Complex query building for features not yet in repository
        let queryText = 'SELECT * FROM leads WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (filters.search) {
            queryText += ` AND (nome ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR cpf ILIKE $${paramIndex})`;
            const term = `%${filters.search}%`;
            params.push(term);
            paramIndex++;
        }

        const status = searchParams.get('status');
        if (status && status !== 'all') {
            const statuses = status.split(',');
            if (statuses.length > 0) {
                const conditions = statuses.map(() => `status = $${paramIndex++}`).join(' OR ');
                queryText += ` AND (${conditions})`;
                statuses.forEach(s => params.push(s.trim()));
            }
        }

        const excludeStatus = searchParams.get('exclude_status');
        if (excludeStatus) {
            const excluded = excludeStatus.split(',');
            if (excluded.length > 0) {
                const conditions = excluded.map(() => `status != $${paramIndex++}`).join(' AND ');
                queryText += ` AND (${conditions})`;
                excluded.forEach(s => params.push(s.trim()));
            }
        }

        const semester = searchParams.get('semester');
        if (semester) {
            const semesters = semester.split(',');
            if (semesters.length > 0) {
                const conditions = semesters.map(() => `tipo_ingresso ILIKE $${paramIndex++}`).join(' OR ');
                queryText += ` AND (${conditions})`;
                semesters.forEach(s => params.push(`%${s.trim()}%`));
            }
        }

        const course = searchParams.get('course');
        if (course) {
            const courses = course.split(',');
            if (courses.length > 0) {
                const conditions = courses.map(() => `curso_interesse ILIKE $${paramIndex++}`).join(' OR ');
                queryText += ` AND (${conditions})`;
                courses.forEach(s => params.push(`%${s.trim()}%`));
            }
        }

        const lastMessagePeriod = searchParams.get('last_message_period');
        if (lastMessagePeriod) {
            if (lastMessagePeriod === '1h') {
                queryText += " AND last_message_time >= NOW() - INTERVAL '1 hour'";
            } else if (lastMessagePeriod === 'today') {
                queryText += " AND last_message_time >= NOW() - INTERVAL '24 hours'";
            } else if (lastMessagePeriod === '1-3d') {
                queryText += " AND last_message_time >= NOW() - INTERVAL '3 days' AND last_message_time < NOW() - INTERVAL '1 day'";
            } else if (lastMessagePeriod === '3-7d') {
                queryText += " AND last_message_time >= NOW() - INTERVAL '7 days' AND last_message_time < NOW() - INTERVAL '3 days'";
            } else if (lastMessagePeriod === '7-15d') {
                queryText += " AND last_message_time >= NOW() - INTERVAL '15 days' AND last_message_time < NOW() - INTERVAL '7 days'";
            } else if (lastMessagePeriod === '15d+') {
                queryText += " AND last_message_time < NOW() - INTERVAL '15 days' AND last_message_time IS NOT NULL";
            } else if (lastMessagePeriod === 'never') {
                queryText += " AND last_message_time IS NULL";
            }
        }

        const isNew = searchParams.get('is_new');
        if (isNew === '1') {
            queryText += ' AND is_new = 1';
        }

        const statusChanged = searchParams.get('status_changed');
        if (statusChanged === '1') {
            queryText += ' AND status_changed = 1';
        }

        // Get total count for pagination
        const countQuery = queryText.replace('SELECT *', 'SELECT COUNT(*) as total');
        const totalResult = await pool.query(countQuery, params);
        const total = parseInt(totalResult.rows[0].total);

        // Sorting
        const sortBy = searchParams.get('sort_by') || 'updated_at';
        const sortOrder = (searchParams.get('sort_order') || 'desc').toUpperCase();

        const allowedColumns = ['nome', 'email', 'telefone', 'cpf', 'status', 'tipo_ingresso', 'curso_interesse', 'escola', 'created_at', 'updated_at', 'last_message_time'];
        const validSortBy = allowedColumns.includes(sortBy) ? sortBy : 'updated_at';
        const validSortOrder = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';

        // Get data
        const offset = (filters.page! - 1) * filters.pageSize!;
        queryText += ` ORDER BY ${validSortBy} ${validSortOrder} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(filters.pageSize, offset);

        const result = await pool.query(queryText, params);

        return NextResponse.json({
            data: result.rows,
            pagination: {
                total,
                page: filters.page,
                limit: filters.pageSize,
                totalPages: Math.ceil(total / filters.pageSize!)
            }
        });
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('[API /api/leads GET] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        // Require authentication
        await requireAuth(req);

        const body = await req.json();
        const { nome, email, telefone, cpf, status, tipo_ingresso } = body;

        if (!nome || !telefone) {
            return NextResponse.json({ error: 'Name and Phone are required' }, { status: 400 });
        }

        const normalizedPhone = normalizePhone(telefone);

        // Use repository to create lead
        const leadData: CreateLeadDto = {
            cpf: cpf && cpf.trim() !== '' ? cpf : normalizedPhone,
            nome,
            telefone: normalizedPhone,
            email,
            status: status || 'NOVO',
            tipo_ingresso,
        };

        const createdLead = await leadRepository.create(leadData);
        console.log('[API /api/leads POST] Lead created successfully:', createdLead.cpf);

        return NextResponse.json({ success: true, data: createdLead });
    } catch (error: unknown) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('[API /api/leads POST] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
            return NextResponse.json({ error: 'CPF or telefone already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        // Require authentication
        await requireAuth(req);

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
            const existing = await leadRepository.findByCpf(cpf);
            if (existing) {
                console.log('[API /api/leads PUT] New CPF already exists');
                return NextResponse.json({ error: 'CPF already exists' }, { status: 409 });
            }

            // Transaction approach for CPF change
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Insert new record with new CPF
                await client.query(`
                    INSERT INTO leads (cpf, nome, email, telefone, status, tipo_ingresso, curso_interesse, escola, created_at, updated_at, last_message, unread_count, last_message_time, profile_image)
                    SELECT $1, $2, $3, $4, $5, $6, $7, $8, created_at, NOW(), last_message, unread_count, last_message_time, profile_image
                    FROM leads WHERE cpf = $9
                `, [cpf, nome, email, normalizePhone(telefone), status, tipo_ingresso, curso_interesse, escola, originalCpf]);

                // Update messages reference
                await client.query('UPDATE messages SET contact_phone = $1 WHERE contact_phone = $2', [cpf, originalCpf]);

                // Delete old record
                await client.query('DELETE FROM leads WHERE cpf = $1', [originalCpf]);

                await client.query('COMMIT');
            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }

            return NextResponse.json({ success: true });
        }

        // Find lead by CPF
        const lead = await leadRepository.findByCpf(targetCpf);
        if (!lead) {
            console.log('[API /api/leads PUT] Lead not found');
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        // Capture old status for activity logging
        const oldStatus = lead.status;

        // Use repository to update
        const updateData: UpdateLeadDto = {
            nome,
            email: email || undefined,
            telefone: normalizePhone(telefone),
            status,
            curso_interesse: curso_interesse || undefined,
            escola: escola || undefined,
            tipo_ingresso: tipo_ingresso || undefined,
        };

        console.log('[API /api/leads PUT] Update data:', updateData);

        await leadRepository.update(targetCpf, updateData);
        console.log('[API /api/leads PUT] Lead updated successfully');

        // Log status change activity if status was changed
        if (status && oldStatus !== status) {
            try {
                await activityService.logStatusChange(targetCpf, oldStatus, status);
                console.log(`[API /api/leads PUT] Status change logged: ${oldStatus} → ${status}`);

                // Trigger automated message if configured
                const result = await statusMessageService.processStatusChange(targetCpf, oldStatus, status);
                if (result.sent) {
                    console.log(`[API /api/leads PUT] ✅ Automated message queued for status: ${status}`);
                } else {
                    console.log(`[API /api/leads PUT] ℹ️ No automated message: ${result.reason}`);
                }
            } catch (activityError) {
                console.error('[API /api/leads PUT] Error logging activity:', activityError);
            }
        }

        // Return updated lead
        const updatedLead = await leadRepository.findByCpf(targetCpf);
        return NextResponse.json({ success: true, data: updatedLead });
    } catch (error: unknown) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('[API /api/leads PUT] Error:', error);
        if (error instanceof Error) {
            console.error('[API /api/leads PUT] Error message:', error.message);
            console.error('[API /api/leads PUT] Error stack:', error.stack);
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
            return NextResponse.json({ error: 'CPF already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        // Require authentication
        await requireAuth(req);

        const { searchParams } = new URL(req.url);
        const cpf = searchParams.get('cpf');
        const telefone = searchParams.get('telefone');
        const all = searchParams.get('all');

        if (all === 'true') {
            await pool.query('DELETE FROM leads');
            return NextResponse.json({ success: true, message: 'All contacts deleted' });
        }

        // Need either CPF or telefone
        if (!cpf && !telefone) {
            return NextResponse.json({ error: 'CPF or telefone is required' }, { status: 400 });
        }

        let lead: any;

        // Try to find by CPF first, then by telefone
        if (cpf) {
            lead = await leadRepository.findByCpf(cpf);
        } else if (telefone) {
            lead = await leadRepository.findByPhone(telefone);
        }

        if (!lead) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        // Delete using CPF (primary key)
        await leadRepository.delete(lead.cpf);

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('[API /api/leads DELETE] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
