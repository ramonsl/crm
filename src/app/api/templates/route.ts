import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        const templates = db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all();
        return NextResponse.json(templates);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, message, type = 'fixed' } = body;

        if (!name || !message) {
            return NextResponse.json({ error: 'Name and message are required' }, { status: 400 });
        }

        const stmt = db.prepare('INSERT INTO templates (name, message, type) VALUES (?, ?, ?)');
        const result = stmt.run(name, message, type);

        return NextResponse.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, name, message, type = 'fixed' } = body;

        if (!id || !name || !message) {
            return NextResponse.json({ error: 'ID, name and message are required' }, { status: 400 });
        }

        const stmt = db.prepare('UPDATE templates SET name = ?, message = ?, type = ? WHERE id = ?');
        const result = stmt.run(name, message, type, id);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const stmt = db.prepare('DELETE FROM templates WHERE id = ?');
        const result = stmt.run(id);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
