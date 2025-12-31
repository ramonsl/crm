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
            chatLogger.debug('Fetching all chats...');

            const chats: WhatsAppWebChat[] = await client.getChats();
            chatLogger.debug(`Found ${chats.length} chats`);

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
                    return `%${normalized.slice(-8)}`;
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
                    \n                        profilePicUrl = await (chat as unknown as { getProfilePicUrl: () => Promise<string> }).getProfilePicUrl();
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
        } catch (error) {
            chatLogger.error('Error fetching chats:', error);
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
            chatLogger.debug(`Fetching ${limit} messages for chat ${chatId}...`);

            const chat = await client.getChatById(chatId);
            chatLogger.debug(`Chat found: ${chat.name}`);

            const messages: WhatsAppWebMessage[] = await chat.fetchMessages({ limit });
            chatLogger.debug(`Raw messages fetched: ${messages.length}`);

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

            chatLogger.debug(`Returning ${chatMessages.length} formatted messages`);
            return chatMessages;
        } catch (error) {
            chatLogger.error('Error fetching messages:', error);
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
            chatLogger.debug(`Marked chat ${chatId} as read`);
        } catch (error) {
            chatLogger.error('Error marking as read:', error);
            throw error;
        }
    }
}

export const whatsAppChatService = new WhatsAppChatService();
