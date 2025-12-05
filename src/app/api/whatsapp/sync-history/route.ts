import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getStatus, getClient } from '@/lib/whatsapp';
import { WHATSAPP_CONFIG } from '@/lib/constants';

// POST /api/whatsapp/sync-history - Sync conversation history from WhatsApp
export async function POST(req: NextRequest) {
    try {
        const status = getStatus();

        if (status.status !== 'ready') {
            return NextResponse.json({
                error: 'WhatsApp não está conectado',
                status: status.status
            }, { status: 400 });
        }

        const client = getClient();
        if (!client) {
            return NextResponse.json({
                error: 'Cliente WhatsApp não disponível'
            }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const { cpf, limit = 30 } = body;

        // Get contacts to sync
        let contacts: any[] = [];
        if (cpf) {
            const contact = db.prepare('SELECT cpf, nome, telefone FROM leads WHERE cpf = ?').get(cpf);
            if (contact) {
                contacts = [contact];
                console.log(`[Sync History] Syncing specific contact: ${(contact as any).nome} (Limit: ${limit})`);
            } else {
                return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
            }
        } else {
            contacts = db.prepare('SELECT cpf, nome, telefone FROM leads WHERE telefone IS NOT NULL').all() as any[];
            console.log(`[Sync History] Starting sync for all ${contacts.length} contacts...`);
        }

        let messagesImported = 0;
        let contactsProcessed = 0;
        let contactsFailed = 0;

        // Process contacts one by one
        for (const contact of contacts) {
            try {
                console.log(`[Sync History] Processing ${contact.nome} (${contact.telefone})...`);

                // Format phone number to chatId
                let formattedPhone = contact.telefone.replace(/\D/g, '');

                if (formattedPhone.startsWith('0')) {
                    formattedPhone = formattedPhone.substring(1);
                }

                if (formattedPhone.length === 10 || formattedPhone.length === 11) {
                    formattedPhone = '55' + formattedPhone;
                }

                // Try variations for Brazilian numbers
                const variations: string[] = [formattedPhone];

                if (formattedPhone.startsWith('55') && formattedPhone.length === 13) {
                    const without9 = formattedPhone.substring(0, 4) + formattedPhone.substring(5);
                    variations.push(without9);
                } else if (formattedPhone.startsWith('55') && formattedPhone.length === 12) {
                    const with9 = formattedPhone.substring(0, 4) + '9' + formattedPhone.substring(4);
                    variations.push(with9);
                }

                let chatFound = false;

                for (const phoneVariation of variations) {
                    try {
                        const chatId = `${phoneVariation} @c.us`;

                        // Get the chat
                        const chat = await client.getChatById(chatId);

                        if (chat) {
                            console.log(`[Sync History] Found chat for ${contact.nome} with ${phoneVariation} `);
                            chatFound = true;

                            // Fetch messages
                            const fetchLimit = cpf ? limit : 200;
                            const messages = await chat.fetchMessages({ limit: fetchLimit });

                            console.log(`[Sync History] Fetched ${messages.length} messages for ${contact.nome}`);

                            // Insert messages into database
                            for (const msg of messages) {
                                try {
                                    // Check if message already exists
                                    const existingMsg = db.prepare(
                                        'SELECT id FROM messages WHERE message_id = ?'
                                    ).get(msg.id.id);

                                    if (!existingMsg) {
                                        const insertStmt = db.prepare(`
                                            INSERT INTO messages(contact_cpf, message_id, direction, body, timestamp, status)
VALUES(?, ?, ?, ?, ?, ?)
    `);

                                        const direction = msg.fromMe ? 'outgoing' : 'incoming';
                                        const timestamp = new Date(msg.timestamp * 1000).toISOString();

                                        // Determine status based on ack
                                        let status = 'sent';
                                        if (msg.ack === 1) status = 'sent';
                                        else if (msg.ack === 2) status = 'delivered';
                                        else if (msg.ack >= 3) status = 'read';
                                        else if (msg.ack === -1) status = 'failed';

                                        // For incoming messages, status is always 'read' (or delivered) effectively
                                        if (direction === 'incoming') status = 'read';

                                        insertStmt.run(contact.cpf, msg.id.id, direction, msg.body, timestamp, status);
                                        messagesImported++;
                                    }
                                } catch (msgError) {
                                    console.error(`[Sync History] Error inserting message: `, msgError);
                                }
                            }

                            // Update contact's last message info
                            if (messages.length > 0) {
                                const lastMsg = messages[messages.length - 1];
                                const updateStmt = db.prepare(`
                                    UPDATE leads
                                    SET last_message = ?,
    last_message_time = ?
        WHERE cpf = ?
            `);
                                const lastMsgTime = new Date(lastMsg.timestamp * 1000).toISOString();
                                updateStmt.run(lastMsg.body, lastMsgTime, contact.cpf);
                            }

                            contactsProcessed++;
                            break; // Found the chat, stop trying variations
                        }
                    } catch (err) {
                        // Continue to next variation
                        console.log(`[Sync History] No chat with variation ${phoneVariation} `);
                    }
                }

                if (!chatFound) {
                    console.log(`[Sync History] No chat found for ${contact.nome}`);
                    contactsFailed++;
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, WHATSAPP_CONFIG.HISTORY_SYNC_DELAY_MS));

            } catch (error: any) {
                contactsFailed++;
                console.error(`[Sync History] Error for ${contact.nome}: `, error);
            }
        }

        console.log(`[Sync History]Completed: ${contactsProcessed} contacts, ${messagesImported} messages imported, ${contactsFailed} failed`);

        return NextResponse.json({
            success: true,
            contactsProcessed,
            messagesImported,
            contactsFailed,
            totalContacts: contacts.length
        });

    } catch (error: any) {
        console.error('[Sync History] Error:', error);
        return NextResponse.json({
            error: 'Erro interno do servidor',
            message: error.message
        }, { status: 500 });
    }
}
