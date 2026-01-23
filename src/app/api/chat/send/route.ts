import { getErrorMessage } from '@/lib/types';
import { NextResponse, NextRequest } from 'next/server';
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory';
import { pool } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { cpf, telefone, message, mediaUrl, mediaType } = body;

        // Accept either telefone (preferred) or cpf
        if ((!cpf && !telefone) || !message) {
            return NextResponse.json({
                error: 'Phone or CPF and message are required'
            }, { status: 400 });
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

        // Get active WhatsApp provider (or default to baileys if none)
        const provider = await WhatsAppProviderFactory.getProvider();

        // Check if ready
        const isReady = await provider.isReady();
        if (!isReady) {
            return NextResponse.json(
                { error: 'WhatsApp is not connected' },
                { status: 503 }
            );
        }

        // YCLOUD 24h Window Check
        // If sending via YCloud (Official API), we must respect the 24h custome service window.
        if (provider.getProviderName() === 'ycloud') {
            // Normalize phone for DB lookup (ensure only digits and 55 prefix)
            let searchPhone = phone.replace(/\D/g, '');
            if (!searchPhone.startsWith('55')) {
                searchPhone = '55' + searchPhone;
            }

            const lastMsgResult = await pool.query(
                'SELECT timestamp FROM messages WHERE contact_phone = $1 AND from_me = false ORDER BY timestamp DESC LIMIT 1',
                [searchPhone]
            );

            const lastMsg = lastMsgResult.rows[0];

            if (!lastMsg) {
                // No previous inbound message found -> Window closed
                return NextResponse.json({
                    error: 'outside_window',
                    message: 'Janela de 24h fechada. Para contatar este usuário, utilize um Modelo de Mensagem (Template).'
                }, { status: 400 });
            }

            const lastMsgTime = new Date(lastMsg.timestamp).getTime();
            const now = Date.now();
            const hoursDiff = (now - lastMsgTime) / (1000 * 60 * 60);

            if (hoursDiff > 24) {
                return NextResponse.json({
                    error: 'outside_window',
                    message: 'Janela de 24h fechada. Para contatar este usuário, utilize um Modelo de Mensagem (Template).'
                }, { status: 400 });
            }
        }

        // Send via WhatsApp using provider
        const result = await provider.sendMessage(phone, message, mediaUrl, mediaType);

        if (!result.success) {
            return NextResponse.json({
                error: result.error || 'Failed to send message'
            }, { status: 500 });
        }

        // Get the CPF for database operations (if not provided, lookup by phone)
        let contactCpf = cpf;
        if (!contactCpf) {
            const contactResult = await pool.query('SELECT cpf FROM leads WHERE telefone = $1', [phone]);
            if (contactResult.rows[0]) {
                contactCpf = contactResult.rows[0].cpf;
            }
        }

        // Store in database
        const messageId = result.messageId || uuidv4();

        if (contactCpf) {
            await pool.query(`
                INSERT INTO messages (id, contact_phone, content, from_me, type, media_url, media_type, timestamp)
                VALUES ($1, $2, $3, true, $4, $5, $6, NOW())
                ON CONFLICT (id) DO NOTHING
            `, [messageId, contactCpf, message, mediaType || 'text', mediaUrl || null, mediaType || null]);

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
    } catch (error: unknown) {
        console.error('Error sending message:', error);
        return NextResponse.json({
            error: getErrorMessage(error) || 'Internal Server Error'
        }, { status: 500 });
    }
}
