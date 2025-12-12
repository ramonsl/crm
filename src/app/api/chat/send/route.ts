import { NextResponse, NextRequest } from 'next/server';
import { sendMessage } from '@/lib/whatsapp';
import { pool } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// POST /api/chat/send
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { cpf, telefone, message, mediaUrl, mediaType } = body;

        // Accept either telefone (preferred) or cpf
        if ((!cpf && !telefone) || !message) {
            return NextResponse.json({ error: 'Phone or CPF and message are required' }, { status: 400 });
        }

        let phone: string;

        // If telefone is provided, use it directly
        if (telefone) {
            phone = telefone;
            console.log(`[API /chat/send] Using telefone from request: "${phone}"`);
        } else {
            // Otherwise, look up phone by CPF
            const result = await pool.query('SELECT telefone FROM leads WHERE cpf = $1', [cpf]);
            const contact = result.rows[0];

            if (!contact) {
                return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
            }
            phone = contact.telefone;
            console.log(`[API /chat/send] Looked up phone by CPF: "${phone}"`);
        }

        console.log(`[API /chat/send] About to send message to phone: "${phone}"`);

        // Send via WhatsApp
        const result = await sendMessage(phone, message, mediaUrl, mediaType);

        // Get the CPF for database operations (if not provided, lookup by phone)
        let contactCpf = cpf;
        if (!contactCpf) {
            const contactResult = await pool.query('SELECT cpf FROM leads WHERE telefone = $1', [phone]);
            if (contactResult.rows[0]) {
                contactCpf = contactResult.rows[0].cpf;
            }
        }

        // Store in database
        const messageId = result.id || uuidv4();

        if (contactCpf) {
            await pool.query(`
                INSERT INTO messages (id, contact_phone, content, from_me, type, media_url, timestamp)
                VALUES ($1, $2, $3, true, $4, $5, NOW())
                ON CONFLICT (id) DO NOTHING
            `, [messageId, contactCpf, message, mediaType || 'text', mediaUrl || null]);

            // Update leads table with last message info
            await pool.query(`
                UPDATE leads 
                SET last_message = $1, 
                    last_message_time = NOW(), 
                    updated_at = NOW() 
                WHERE cpf = $2
            `, [message, contactCpf]);
        } else {
            // Fallback: update by phone if no CPF found
            await pool.query(`
                UPDATE leads 
                SET last_message = $1, 
                    last_message_time = NOW(), 
                    updated_at = NOW() 
                WHERE telefone = $2
            `, [message, phone]);
        }

        return NextResponse.json({ success: true, messageId });
    } catch (error: any) {
        console.error('Error sending message:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
