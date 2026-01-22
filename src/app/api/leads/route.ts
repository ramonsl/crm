import { NextResponse, NextRequest } from 'next/server';
import { LeadRepository, ActivityRepository } from '@/lib/repositories';
import { normalizePhone } from '@/lib/utils';
import type { LeadFilters, CreateLeadDto, UpdateLeadDto } from '@/lib/repositories';
import { ActivityService } from '@/services/activityService';
import { statusMessageService } from '@/services/StatusMessageService';
import { AppError } from '@/lib/errors/AppError';
import { handleApiError } from '@/lib/api/handleApiError';
import { pool } from '@/lib/db'; // Still needed for transaction in PUT? No, moved to repo.

// Initialize repositories and services
const leadRepository = new LeadRepository();
const activityRepository = new ActivityRepository();
const activityService = new ActivityService(activityRepository);

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        // Build filters from query params
        const filters: LeadFilters & Record<string, any> = {
            page: parseInt(searchParams.get('page') || '1'),
            pageSize: parseInt(searchParams.get('limit') || '10'),
            search: searchParams.get('search') || undefined,
            status: searchParams.get('status') || undefined,
            exclude_status: searchParams.get('exclude_status') || undefined,
            semester: searchParams.get('semester') || undefined,
            course: searchParams.get('course') || undefined,
            last_message_period: searchParams.get('last_message_period') || undefined,
            is_new: searchParams.get('is_new') || undefined,
            status_changed: searchParams.get('status_changed') || undefined,
            hasUnread: searchParams.has('hasUnread') ? true : undefined,
            sort_by: searchParams.get('sort_by') || undefined,
            sort_order: searchParams.get('sort_order') || undefined,
        };

        const result = await leadRepository.findAll(filters);

        return NextResponse.json({
            data: result.data,
            pagination: {
                total: result.total,
                page: filters.page,
                limit: filters.pageSize,
                totalPages: Math.ceil(result.total / filters.pageSize!)
            }
        });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { nome, email, telefone, cpf, status, tipo_ingresso } = body;

        if (!nome || !telefone) {
            throw new AppError('Name and Phone are required', 400);
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
    } catch (error) {
        return handleApiError(error);
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        console.log('[API /api/leads PUT] Received body:', body);
        const { nome, email, telefone, cpf, status, tipo_ingresso, curso_interesse, escola, originalCpf } = body;

        if (!nome || !telefone || !cpf) {
            throw new AppError('Name, Phone and CPF are required', 400);
        }

        const targetCpf = originalCpf || cpf;
        console.log('[API /api/leads PUT] Target CPF:', targetCpf);

        // If CPF is changing, handle FK constraints via Repository Transaction
        if (originalCpf && originalCpf !== cpf) {
            console.log('[API /api/leads PUT] CPF changing from', originalCpf, 'to', cpf);

            // Check if new CPF already exists
            const existing = await leadRepository.findByCpf(cpf);
            if (existing) {
                throw new AppError('CPF already exists', 409);
            }

            // Find old lead data to copy
            const oldLead = await leadRepository.findByCpf(originalCpf);
            if (!oldLead) {
                throw new AppError('Original contact not found', 404);
            }

            // Perform transactional update
            await leadRepository.updateCpf(originalCpf, cpf, {
                ...oldLead,
                nome,
                email,
                telefone: normalizePhone(telefone),
                status,
                tipo_ingresso,
                curso_interesse,
                escola
            });

            return NextResponse.json({ success: true });
        }

        // Find lead by CPF
        const lead = await leadRepository.findByCpf(targetCpf);
        if (!lead) {
            throw new AppError('Contact not found', 404);
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

        await leadRepository.update(targetCpf, updateData);

        // Log status change activity if status was changed
        if (status && oldStatus !== status) {
            try {
                await activityService.logStatusChange(targetCpf, oldStatus, status);

                // Trigger automated message if configured
                const result = await statusMessageService.processStatusChange(targetCpf, oldStatus, status);
                if (result.sent) {
                    console.log(`[API /api/leads PUT] ✅ Automated message queued for status: ${status}`);
                }
            } catch (activityError) {
                console.error('[API /api/leads PUT] Error logging activity:', activityError);
            }
        }

        // Return updated lead
        const updatedLead = await leadRepository.findByCpf(targetCpf);
        return NextResponse.json({ success: true, data: updatedLead });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const cpf = searchParams.get('cpf');
        const telefone = searchParams.get('telefone');
        const all = searchParams.get('all');

        if (all === 'true') {
            await leadRepository.deleteAll();
            return NextResponse.json({ success: true, message: 'All contacts deleted' });
        }

        // Need either CPF or telefone
        if (!cpf && !telefone) {
            throw new AppError('CPF or telefone is required', 400);
        }

        let lead: any;

        // Try to find by CPF first, then by telefone
        if (cpf) {
            lead = await leadRepository.findByCpf(cpf);
        } else if (telefone) {
            lead = await leadRepository.findByPhone(telefone);
        }

        if (!lead) {
            throw new AppError('Contact not found', 404);
        }

        // Delete using CPF (primary key)
        await leadRepository.delete(lead.cpf);

        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
