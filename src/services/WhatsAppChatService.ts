/**
 * WhatsApp Chat Service
 * 
 * Service responsible for synchronizing WhatsApp chats and messages
 * Following Single Responsibility Principle (SOLID)
 */

import { getClient, getStatus } from '@/lib/whatsapp';
import type { WhatsAppChat, WhatsAppMessage } from '@/lib/types';
import { pool } from '@/lib/db';

export interface ChatInfo {
    id: string;
    name: string;
    leadName: string | null;
    cpf: string | null;
    profilePicUrl: string | null;
    lastMessage: string | null;
    lastMessageTime: number | null;
    unreadCount: number;
    isGroup: boolean;
    phone: string | null;
    status: string | null;
    isRegistered: boolean;
}

export interface ChatMessage {
    id: string;
    body: string;
    fromMe: boolean;
    timestamp: number;
    hasMedia: boolean;
    mediaUrl: string | null;
    mediaType: 'image' | 'video' | 'audio' | 'document' | null;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    ack: number;
}

export class WhatsAppChatService {
    private isReady(): boolean {
        const status = getStatus();
        return status.status === 'ready';
    }

    async getAllChats(includeGroups: boolean = false): Promise<ChatInfo[]> {
        if (!this.isReady()) {
            throw new Error('WhatsApp is not connected');
        }

        const client = getClient();
        if (!client) {
            throw new Error('WhatsApp client not available');
        }

        try {
            console.log('[WhatsAppChatService] Fetching all chats...');

            const chats: any[] = await client.getChats();
            console.log(`[WhatsAppChatService] Found ${chats.length} chats`);

            const chatInfos: ChatInfo[] = [];

            for (const chat of chats) {
                if (chat.isGroup && !includeGroups) {
                    continue;
                }

                let profilePicUrl: string | null = null;
                try {
                    profilePicUrl = await (chat as any).getProfilePicUrl();

                    if (profilePicUrl && !chat.isGroup) {
                        const phoneToSync = chat.id._serialized.split('@')[0];
                        try {
                            await pool.query(
                                'UPDATE leads SET profile_image = $1 WHERE telefone LIKE $2',
                                [profilePicUrl, `%${phoneToSync}%`]
                            );
                            console.log(`[WhatsAppChatService] ✓ Synced profile pic to DB for ${chat.name}`);
                        } catch (syncErr) {
                            console.warn(`[WhatsAppChatService] Failed to sync profile pic to DB:`, syncErr);
                        }
                    }
                } catch (err) {
                    console.warn(`[WhatsAppChatService] No profile pic from API for ${chat.name}`);

                    if (!chat.isGroup) {
                        try {
                            const phoneToSearch = chat.id._serialized.split('@')[0];

                            const result = await pool.query(`
                                SELECT profile_image 
                                FROM leads 
                                WHERE (
                                    telefone LIKE $1 
                                    OR telefone LIKE $2
                                    OR telefone LIKE $3
                                )
                                AND profile_image IS NOT NULL 
                                LIMIT 1
                            `, [
                                `%${phoneToSearch}%`,
                                `%${phoneToSearch.slice(-11)}%`,
                                `%${phoneToSearch.slice(-10)}%`
                            ]);

                            if (result.rows[0]?.profile_image) {
                                profilePicUrl = result.rows[0].profile_image;
                                console.log(`[WhatsAppChatService] ✓ Using DB profile pic for ${chat.name}`);
                            }
                        } catch (dbErr) {
                            console.warn(`[WhatsAppChatService] Failed to fetch DB profile pic:`, dbErr);
                        }
                    }
                }

                let phone: string | null = null;
                let status: string | null = null;
                let leadName: string | null = null;
                let cpf: string | null = null;
                let isRegistered: boolean = false;
                const isLidContact = chat.id._serialized.includes('@lid');

                if (!chat.isGroup) {
                    if (!isLidContact) {
                        const idParts = chat.id._serialized.split('@');
                        if (idParts.length > 0 && idParts[0].length >= 10 && idParts[0].length <= 15) {
                            phone = idParts[0];
                        }

                        if (!phone && chat.id.user) {
                            const userId = chat.id.user;
                            if (userId.length >= 10 && userId.length <= 15) {
                                phone = userId;
                            }
                        }
                    }
                }

                let lastMessage: string | null = null;
                let lastMessageTime: number | null = null;

                try {
                    const messages: any[] = await chat.fetchMessages({ limit: 5 });
                    if (messages.length > 0) {
                        const msg = messages[0];
                        lastMessage = msg.body || '[Media]';
                        lastMessageTime = msg.timestamp;

                        if (!phone && !chat.isGroup && isLidContact) {
                            for (const m of messages) {
                                const phoneId = m.fromMe ? m.to : m.from;

                                if (phoneId && phoneId.includes('@c.us')) {
                                    const cleanPhone = phoneId.replace('@c.us', '');
                                    if (cleanPhone.length >= 10 && cleanPhone.length <= 15) {
                                        phone = cleanPhone;
                                        console.log(`[WhatsAppChatService] ✓ Found phone from message for @lid contact ${chat.name}: ${phone}`);
                                        break;
                                    }
                                }
                            }

                            if (!phone) {
                                try {
                                    const result = await pool.query(`
                                        SELECT telefone 
                                        FROM leads 
                                        WHERE nome LIKE $1 
                                        AND telefone IS NOT NULL 
                                        AND telefone != ''
                                        LIMIT 1
                                    `, [`%${chat.name}%`]);

                                    if (result.rows[0]?.telefone) {
                                        phone = result.rows[0].telefone.replace(/\D/g, '');
                                        console.log(`[WhatsAppChatService] ✓ Found phone from DB for @lid contact ${chat.name}: ${phone}`);
                                    }
                                } catch (dbErr) {
                                    console.warn(`[WhatsAppChatService] Failed to search DB for ${chat.name}:`, dbErr);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`[WhatsAppChatService] Failed to fetch last message for ${chat.name}`);
                }

                if (!phone && !chat.isGroup && chat.name) {
                    const phoneMatch = chat.name.match(/\+?\d[\d\s\-\(\)]+/);
                    if (phoneMatch) {
                        const extracted = phoneMatch[0].replace(/\D/g, '');
                        if (extracted.length >= 10 && extracted.length <= 15) {
                            phone = extracted;
                            console.log(`[WhatsAppChatService] ✓ Extracted phone from chat name "${chat.name}": ${phone}`);
                        }
                    }
                }

                if (!chat.isGroup && phone) {
                    try {
                        const normalizedPhone = phone.replace(/\D/g, '');
                        const last8 = normalizedPhone.slice(-8);

                        console.log(`[WhatsAppChatService] 🔍 "${chat.name}" - original: "${phone}", normalized: "${normalizedPhone}", last8: "${last8}"`);

                        const result = await pool.query(`
                            SELECT nome, cpf, status, telefone
                            FROM leads 
                            WHERE telefone LIKE $1
                            LIMIT 1
                        `, [`%${last8}`]);

                        const dbLead = result.rows[0];

                        if (dbLead) {
                            leadName = dbLead.nome;
                            cpf = dbLead.cpf;
                            status = dbLead.status;
                            isRegistered = true;
                            console.log(`[WhatsAppChatService] ✅ MATCH! "${chat.name}" → "${leadName}" (${status}) | DB phone: ${dbLead.telefone}`);
                        } else {
                            console.log(`[WhatsAppChatService] ❌ No match for last 8: "${last8}"`);
                        }
                    } catch (dbErr) {
                        console.error(`[WhatsAppChatService] ❌ DB Error:`, dbErr);
                    }
                } else if (!chat.isGroup) {
                    console.log(`[WhatsAppChatService] ⚠️ No phone for "${chat.name}"`);
                }

                chatInfos.push({
                    id: chat.id._serialized,
                    name: chat.name,
                    leadName,
                    cpf,
                    profilePicUrl,
                    lastMessage,
                    lastMessageTime,
                    unreadCount: chat.unreadCount,
                    isGroup: chat.isGroup,
                    phone,
                    status,
                    isRegistered
                });
            }

            chatInfos.sort((a, b) => {
                const timeA = a.lastMessageTime || 0;
                const timeB = b.lastMessageTime || 0;
                return timeB - timeA;
            });

            console.log(`[WhatsAppChatService] Returning ${chatInfos.length} chats`);
            return chatInfos;
        } catch (error) {
            console.error('[WhatsAppChatService] Error fetching chats:', error);
            throw error;
        }
    }

    async getChatMessages(chatId: string, limit: number = 50): Promise<ChatMessage[]> {
        if (!this.isReady()) {
            throw new Error('WhatsApp is not connected');
        }

        const client = getClient();
        if (!client) {
            throw new Error('WhatsApp client not available');
        }

        try {
            console.log(`[WhatsAppChatService] Fetching ${limit} messages for chat ${chatId}...`);

            const chat = await client.getChatById(chatId);
            console.log(`[WhatsAppChatService] Chat found: ${chat.name}`);

            const messages: any[] = await chat.fetchMessages({ limit });
            console.log(`[WhatsAppChatService] Raw messages fetched: ${messages.length}`);

            const chatMessages: ChatMessage[] = messages.map(msg => {
                let status: 'sent' | 'delivered' | 'read' | 'failed' = 'sent';
                const ack = msg.ack || 0;
                if (ack === -1) status = 'failed';
                else if (ack === 1) status = 'sent';
                else if (ack === 2) status = 'delivered';
                else if (ack >= 3) status = 'read';

                return {
                    id: msg.id.id,
                    body: msg.body || '[Sem conteúdo]',
                    fromMe: msg.fromMe,
                    timestamp: msg.timestamp,
                    hasMedia: msg.hasMedia,
                    mediaUrl: null,
                    mediaType: null,
                    status,
                    ack
                };
            });

            console.log(`[WhatsAppChatService] Returning ${chatMessages.length} formatted messages`);
            return chatMessages;
        } catch (error) {
            console.error('[WhatsAppChatService] Error fetching messages:', error);
            throw error;
        }
    }

    async markAsRead(chatId: string): Promise<void> {
        if (!this.isReady()) {
            throw new Error('WhatsApp is not connected');
        }

        const client = getClient();
        if (!client) {
            throw new Error('WhatsApp client not available');
        }

        try {
            const chat = await client.getChatById(chatId);
            await chat.sendSeen();
            console.log(`[WhatsAppChatService] Marked chat ${chatId} as read`);
        } catch (error) {
            console.error('[WhatsAppChatService] Error marking as read:', error);
            throw error;
        }
    }
}

export const whatsAppChatService = new WhatsAppChatService();
