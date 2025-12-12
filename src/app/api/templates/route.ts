import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
    try {
        const result = await pool.query('SELECT * FROM templates ORDER BY created_at DESC');
        return NextResponse.json(result.rows);
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

        const result = await pool.query(
            'INSERT INTO templates (name, message, type) VALUES ($1, $2, $3) RETURNING id',
            [name, message, type]
        );

        return NextResponse.json({ success: true, id: result.rows[0].id });
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

        const result = await pool.query(
            'UPDATE templates SET name = $1, message = $2, type = $3 WHERE id = $4',
            [name, message, type, id]
        );

        if (result.rowCount === 0) {
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

        const result = await pool.query('DELETE FROM templates WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
