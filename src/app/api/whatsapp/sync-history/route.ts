import { getErrorMessage } from '@/lib/types';

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getStatus, getClient } from '@/lib/whatsapp';
import { WHATSAPP_CONFIG } from '@/lib/constants';

export async function POST(req: NextRequest) {
    try {
        const status = await getStatus();

        if (status.status !== 'ready') {
            return NextResponse.json({ error: 'WhatsApp não está conectado', status: status.status }, { status: 400 });
        }

        const client = getClient();
        if (!client) {
            return NextResponse.json({ error: 'Cliente WhatsApp não disponível' }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const { cpf, limit = 30 } = body;

        // Get contacts to sync
        let contacts: any[] = [];
        if (cpf) {
            const result = await pool.query('SELECT cpf, nome, telefone FROM leads WHERE cpf = $1', [cpf]);
            if (result.rows[0]) {
                contacts = [result.rows[0]];
                console.log(`[Sync History] Syncing specific contact: ${result.rows[0].nome}`);
            } else {
                return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
            }
        } else {
            const result = await pool.query('SELECT cpf, nome, telefone FROM leads WHERE telefone IS NOT NULL');
            contacts = result.rows;
            console.log(`[Sync History] Starting sync for all ${contacts.length} contacts...`);
        }

        let messagesImported = 0;
        let contactsProcessed = 0;
        let contactsFailed = 0;

        for (const contact of contacts) {
            try {
                console.log(`[Sync History] Processing ${contact.nome} (${contact.telefone})...`);

                let formattedPhone = contact.telefone.replace(/\D/g, '');
                if (formattedPhone.startsWith('0')) formattedPhone = formattedPhone.substring(1);
                if (formattedPhone.length === 10 || formattedPhone.length === 11) {
                    formattedPhone = '55' + formattedPhone;
                }

                const variations: string[] = [formattedPhone];
                if (formattedPhone.startsWith('55') && formattedPhone.length === 13) {
                    variations.push(formattedPhone.substring(0, 4) + formattedPhone.substring(5));
                } else if (formattedPhone.startsWith('55') && formattedPhone.length === 12) {
                    variations.push(formattedPhone.substring(0, 4) + '9' + formattedPhone.substring(4));
                }

                let chatFound = false;

                for (const phoneVariation of variations) {
                    try {
                        const chatId = `${phoneVariation}@c.us`;
                        const client = await getClient(); // Added await and re-declared client as per instruction
                        if (!client) { // Added check for client availability
                            console.error('[Sync History] WhatsApp client not available inside loop.');
                            continue; // Skip to next variation if client is not available
                        }
                        const chat = await client.getChatById(chatId);

                        if (chat) {
                            console.log(`[Sync History] Found chat for ${contact.nome} with ${phoneVariation}`);
                            chatFound = true;

                            const fetchLimit = cpf ? limit : 200;
                            const messages = await (chat as any).fetchMessages({ limit: fetchLimit });

                            console.log(`[Sync History] Fetched ${messages.length} messages for ${contact.nome}`);

                            // Optimized: Batch insert all messages at once
                            if (messages.length > 0) {
                                try {
                                    const values: any[] = [];
                                    const placeholders: string[] = [];

                                    messages.forEach((msg: any, index: number) => {
                                        const from_me = msg.fromMe;
                                        const timestamp = new Date(msg.timestamp * 1000).toISOString();
                                        // 5 params per row
                                        const offset = index * 5;

                                        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, 'text')`);
                                        values.push(msg.id.id, contact.cpf, msg.body || '', from_me, timestamp);
                                    });

                                    const query = `
                                        INSERT INTO messages (id, contact_phone, content, from_me, timestamp, type)
                                        VALUES ${placeholders.join(', ')}
                                        ON CONFLICT (id) DO NOTHING
                                    `;

                                    const batchResult = await pool.query(query, values);
                                    messagesImported += batchResult.rowCount || 0;

                                    console.log(`[Sync History] Batch inserted ${batchResult.rowCount} new messages for ${contact.nome}`);
                                } catch (batchError) {
                                    console.error(`[Sync History] Error in batch insert:`, batchError);
                                }
                            }

                            // Update last message info
                            if (messages.length > 0) {
                                const lastMsg = messages[messages.length - 1];
                                const lastMsgTime = new Date(lastMsg.timestamp * 1000).toISOString();
                                await pool.query(`
                                    UPDATE leads SET last_message = $1, last_message_time = $2 WHERE cpf = $3
                                `, [lastMsg.body, lastMsgTime, contact.cpf]);
                            }

                            contactsProcessed++;
                            break;
                        }
                    } catch (err) {
                        console.log(`[Sync History] No chat with variation ${phoneVariation}`);
                    }
                }

                if (!chatFound) {
                    console.log(`[Sync History] No chat found for ${contact.nome}`);
                    contactsFailed++;
                }

                await new Promise(resolve => setTimeout(resolve, WHATSAPP_CONFIG.HISTORY_SYNC_DELAY_MS));

            } catch (error: unknown) {
                contactsFailed++;
                console.error(`[Sync History] Error for ${contact.nome}:`, error);
            }
        }

        console.log(`[Sync History] Completed: ${contactsProcessed} contacts, ${messagesImported} messages imported`);

        return NextResponse.json({ success: true, contactsProcessed, messagesImported, contactsFailed, totalContacts: contacts.length });

    } catch (error: unknown) {
        console.error('[Sync History] Error:', error);
        return NextResponse.json({ error: 'Erro interno do servidor', message: getErrorMessage(error) }, { status: 500 });
    }
}
