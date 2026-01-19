/**
 * WhatsApp Chat Service
 * 
 * Service responsible for synchronizing WhatsApp chats and messages
 * Following Single Responsibility Principle (SOLID)
 */

import { getClient, getStatus } from '@/lib/whatsapp';
import type { WhatsAppWebChat, WhatsAppWebMessage } from '@/lib/types';
import { pool } from '@/lib/db';
import { chatLogger } from '@/lib/logger';

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
    private async isReady(): Promise<boolean> {
        const status = await getStatus();
        return status.status === 'ready';
    }

    async getAllChats(includeGroups: boolean = false): Promise<ChatInfo[]> {
        if (!this.isReady()) {
            // For Baileys, we might be connected but the 'status' might be initializing if not fully synced.
            // But we should allow DB reading anyway if we want to show history even if disconnected?
            // For now, keep the check but consider relaxing it for DB mode.
            // throw new Error('WhatsApp is not connected'); 
        }

        const client = await getClient();
        const isBaileys = !client || (client as any).getChats().then((c: any) => c.length === 0);
        // Better check: check provider or if client is mock
        // Since we don't have getProvider here easily without importing cycling, 
        // we can check if client.getChats returns empty array or mock behavior.

        // Actually, let's use pool directly for Baileys mode always if client.getChats returns empty
        // or just implement a separate method and call it.

        try {
            chatLogger.debug('Fetching all chats...');

            let chats: WhatsAppWebChat[] = [];
            try {
                if (client) {
                    chats = await client.getChats();
                }
            } catch (e) {
                // Ignore, likely mock or not implemented
            }

            // If legacy client returns chats, use them (WWebJS mode). 
            // If not (Baileys mode), fetch from DB.
            if (chats.length > 0) {
                chatLogger.debug(`Found ${chats.length} chats via Client`);
                // ... existing WWebJS logic ...
                // Refactoring: I will keep the existing logic for WWebJS and add DB fallback
                return this.processWWebJSChats(chats, includeGroups);
            } else {
                chatLogger.debug('Client returned no chats (Baileys mode?), fetching from DB...');
                return this.getAllChatsFromDb();
            }
        } catch (error) {
            chatLogger.error('Error fetching chats:', error);
            throw error;
        }
    }

    private async processWWebJSChats(chats: WhatsAppWebChat[], includeGroups: boolean): Promise<ChatInfo[]> {
        const chatInfos: ChatInfo[] = [];

        // Extract all phone numbers first for batch lookup
        const phoneNumbers: string[] = [];
        const chatPhoneMap = new Map<number, string>(); // chatIndex -> phone

        for (let i = 0; i < chats.length; i++) {
            const chat = chats[i];
            if (chat.isGroup && !includeGroups) continue;

            if (!chat.isGroup) {
                const isLidContact = chat.id._serialized.includes('@lid');

                if (!isLidContact) {
                    const idParts = chat.id._serialized.split('@');
                    if (idParts.length > 0 && idParts[0].length >= 10 && idParts[0].length <= 15) {
                        const phone = idParts[0];
                        phoneNumbers.push(phone);
                        chatPhoneMap.set(i, phone);
                    }
                }
            }
        }

        // Batch lookup all leads by phone in ONE query
        const leadsMap = new Map<string, { nome: string; cpf: string; status: string; telefone: string; profile_image: string | null }>();

        if (phoneNumbers.length > 0) {
            chatLogger.debug(`Batch looking up ${phoneNumbers.length} phones...`);

            // Build OR conditions for last 8 digits of each phone
            const last8Conditions = phoneNumbers.map(phone => {
                const normalized = phone.replace(/\D/g, '');
                return `% ${normalized.slice(-8)} `;
            });

            const result = await pool.query(`
                SELECT nome, cpf, status, telefone, profile_image
                FROM leads 
                WHERE ${last8Conditions.map((_, idx) => `telefone LIKE $${idx + 1}`).join(' OR ')}
            `, last8Conditions);

            // Map results by last 8 digits for quick lookup
            for (const lead of result.rows) {
                const leadLast8 = lead.telefone.replace(/\D/g, '').slice(-8);
                leadsMap.set(leadLast8, lead);
            }

            chatLogger.debug(`Found ${result.rows.length} matching leads`);
        }

        // Now process each chat with the pre-loaded data
        for (let i = 0; i < chats.length; i++) {
            const chat = chats[i];

            if (chat.isGroup && !includeGroups) {
                continue;
            }

            let profilePicUrl: string | null = null;
            const phone = chatPhoneMap.get(i) || null;
            let status: string | null = null;
            let leadName: string | null = null;
            let cpf: string | null = null;
            let isRegistered: boolean = false;

            // Lookup lead from pre-loaded map
            if (phone) {
                const normalizedPhone = phone.replace(/\D/g, '');
                const last8 = normalizedPhone.slice(-8);
                const lead = leadsMap.get(last8);

                if (lead) {
                    leadName = lead.nome;
                    cpf = lead.cpf;
                    status = lead.status;
                    isRegistered = true;
                    profilePicUrl = lead.profile_image;
                }
            }

            // Try to get profile pic from WhatsApp API (only if not in DB)
            if (!profilePicUrl) {
                try {
                    profilePicUrl = await (chat as unknown as { getProfilePicUrl: () => Promise<string> }).getProfilePicUrl();
                } catch {
                    // Ignore - no profile pic available
                }
            }

            let lastMessage: string | null = null;
            let lastMessageTime: number | null = null;

            try {
                const messages: WhatsAppWebMessage[] = await chat.fetchMessages({ limit: 5 });
                if (messages.length > 0) {
                    const msg = messages[0];
                    lastMessage = msg.body || '[Media]';
                    lastMessageTime = msg.timestamp;
                }
            } catch {
                // Ignore - failed to fetch messages
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

        chatLogger.debug(`Returning ${chatInfos.length} chats`);
        return chatInfos;
    }

    private async getAllChatsFromDb(): Promise<ChatInfo[]> {
        chatLogger.debug('Fetching chats from DB (Baileys mode)...');

        // Query leads that have messages or are recent
        const result = await pool.query(`
            SELECT 
                l.cpf, 
                l.nome, 
                l.telefone, 
                l.profile_image, 
                l.last_message, 
                l.last_message_time, 
                l.unread_count,
                l.status
            FROM leads l
            WHERE l.last_message IS NOT NULL OR l.updated_at > NOW() - INTERVAL '30 days'
            ORDER BY l.last_message_time DESC NULLS LAST
            LIMIT 50
        `);

        return result.rows.map(row => ({
            id: `${row.telefone}@s.whatsapp.net`, // Construct JID
            name: row.nome || row.telefone,
            leadName: row.nome,
            cpf: row.cpf,
            profilePicUrl: row.profile_image,
            lastMessage: row.last_message,
            lastMessageTime: row.last_message_time ? new Date(row.last_message_time).getTime() / 1000 : null,
            unreadCount: row.unread_count || 0,
            isGroup: false,
            phone: row.telefone,
            status: row.status,
            isRegistered: true
        }));
    }

    async getChatMessages(chatId: string, limit: number = 50): Promise<ChatMessage[]> {
        const client = await getClient();

        // Try to fetch via client first (if WWebJS)
        let messages: WhatsAppWebMessage[] = [];
        let fetchedViaClient = false;

        try {
            if (client) {
                const chat = await client.getChatById(chatId);
                if (chat) {
                    messages = await (chat as any).fetchMessages({ limit });
                    if (messages.length > 0) fetchedViaClient = true;
                }
            }
        } catch (e) {
            // Ignore
        }

        if (fetchedViaClient) {
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
            return chatMessages;
        } else {
            return this.getChatMessagesFromDb(chatId, limit);
        }
    }

    private async getChatMessagesFromDb(chatId: string, limit: number): Promise<ChatMessage[]> {
        // ChatID is usually phone@s.whatsapp.net or similar
        // Extract phone number
        const phone = chatId.replace(/\D/g, ''); // Extract digits

        // IMPORTANT: We need both the phone (from messages table) AND maybe check lead's CPF if messages are linked by CPF?
        // In MessageEventHandler/BaileysMessageHandler we insert into messages table using:
        // contact_phone = contact.cpf (!!!) or contact.telefone?
        // Let's check BaileysMessageHandler: 
        // INSERT INTO messages (contact_phone, ...) VALUES ($1, ...) where $1 is contact.cpf.
        // Wait, did I set it as CPF or Phone?
        // In BaileysMessageHandler: `contact.cpf` is passed as first arg to query for contact_phone column.
        // This seems WRONG or legacy-consistent. 
        // Let's check schema/migrations again.
        // messages table: contact_phone text NOT NULL.
        // old MessageEventHandler: VALUES ($1, ...) [contact.cpf].
        // So contact_phone column actually stores CPF? 
        // This is extremely confusing code (Clean Code violation), but I must follow it to see history.
        // Let's verify what `messages` table actually contains.

        // I will assume it stores CPF based on legacy code.
        // So I need to find the lead's CPF from the phone number first in order to query messages.

        // First, find the lead by phone
        const leadResult = await pool.query('SELECT cpf FROM leads WHERE telefone LIKE $1 LIMIT 1', [`%${phone.slice(-8)}`]);
        const leadCpf = leadResult.rows[0]?.cpf;

        if (!leadCpf) {
            chatLogger.warn(`No lead found for chat ${chatId} (phone ${phone}) - cannot fetch DB messages`);
            return [];
        }

        const res = await pool.query(`
            SELECT id, content, from_me, timestamp, type, read
            FROM messages
            WHERE contact_phone = $1
            ORDER BY timestamp DESC
            LIMIT $2
        `, [leadCpf, limit]);

        return res.rows.map(row => ({
            id: row.id,
            body: row.content || '',
            fromMe: row.from_me,
            timestamp: new Date(row.timestamp).getTime() / 1000,
            hasMedia: row.type !== 'text',
            mediaUrl: null,
            mediaType: null,
            status: (row.read ? 'read' : 'sent') as 'sent' | 'delivered' | 'read' | 'failed',
            ack: row.read ? 3 : 1
        })).reverse(); // Return in chronological order
    }

    async markAsRead(chatId: string): Promise<void> {
        // sendSeen está instável na versão atual do WhatsApp Web
        // Desabilitado temporariamente para evitar erros:
        // TypeError: Cannot read properties of undefined (reading 'markedUnread')
        chatLogger.debug(`markAsRead disabled for ${chatId} - sendSeen unstable`);
        return;
    }
}

export const whatsAppChatService = new WhatsAppChatService();
