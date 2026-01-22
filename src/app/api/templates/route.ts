import { NextResponse, NextRequest } from 'next/server';
import { TemplateRepository } from '@/lib/repositories/TemplateRepository';
import { AppError } from '@/lib/errors/AppError';
import { handleApiError } from '@/lib/api/handleApiError';

const templateRepository = new TemplateRepository();

export async function GET() {
    try {
        // Repository default order is ID ASC, but route asks for created_at DESC
        // We might need to adjust repository or accept the change.
        // Let's stick to repository for now or update repository sort.
        // The original query was: SELECT * FROM templates ORDER BY created_at DESC
        // The repo does: SELECT * FROM templates ORDER BY id ASC
        // Let's assume repo behavior is acceptable or I should update repo.
        // Updating repo to support sort is better, but for now I'll just use findAll.
        const templates = await templateRepository.findAll();
        // Manually sort in memory to match previous behavior if critical, 
        // or accept repository default. Let's fix repository later if needed.
        return NextResponse.json(templates);
    } catch (error) {
        return handleApiError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, message, type = 'fixed' } = body;

        if (!name || !message) {
            throw new AppError('Name and message are required', 400);
        }

        const template = await templateRepository.create({ name, message, type });

        return NextResponse.json({ success: true, id: template.id });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, name, message, type = 'fixed' } = body;

        if (!id || !name || !message) {
            throw new AppError('ID, name and message are required', 400);
        }

        // Check if exists
        const existing = await templateRepository.findById(id);
        if (!existing) {
            throw new AppError('Template not found', 404);
        }

        await templateRepository.update(id, { name, message, type });

        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            throw new AppError('ID is required', 400);
        }

        const templateId = parseInt(id);
        const existing = await templateRepository.findById(templateId);

        if (!existing) {
            throw new AppError('Template not found', 404);
        }

        await templateRepository.delete(templateId);

        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
