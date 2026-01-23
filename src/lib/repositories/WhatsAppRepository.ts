/**
 * WhatsAppRepository - PostgreSQL Implementation
 * Handles database operations for WhatsApp chats and messages
 */

import { pool } from '../db';
import { dbLogger } from '@/lib/logger';
import type { ChatMessage, ChatInfo } from '@/services/WhatsAppChatService';
import type { CreateMessageDto } from './dtos';

export class WhatsAppRepository {

    async findAllChats(): Promise<ChatInfo[]> {
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
            WHERE (l.last_message IS NOT NULL 
               OR l.updated_at > NOW() - INTERVAL '30 days')
               AND l.telefone IS NOT NULL 
               AND l.telefone != ''
               AND LENGTH(l.telefone) <= 15
               AND l.telefone ~ '^[0-9]+$'
            ORDER BY l.last_message_time DESC NULLS LAST
            LIMIT 100
        `);

        return result.rows.map(row => ({
            id: `${row.telefone.replace(/\D/g, '')}@s.whatsapp.net`,
            name: row.nome || row.telefone,
            leadName: row.nome,
            cpf: row.cpf,
            profilePicUrl: row.profile_image,
            lastMessage: row.last_message,
            lastMessageTime: row.last_message_time
                ? new Date(row.last_message_time).getTime() / 1000
                : null,
            unreadCount: row.unread_count || 0,
            isGroup: false,
            phone: row.telefone,
            status: row.status,
            isRegistered: true
        }));
    }

    async findMessagesByCpf(cpf: string, limit: number = 50): Promise<ChatMessage[]> {
        const result = await pool.query(`
            SELECT 
                id, 
                content, 
                from_me, 
                timestamp, 
                type, 
                read,
                media_url,
                media_type
            FROM messages
            WHERE contact_phone = $1
            ORDER BY timestamp DESC
            LIMIT $2
        `, [cpf, limit]);

        // Helper to normalize media type
        const normalizeMediaType = (type: string | null): 'image' | 'video' | 'audio' | 'document' | null => {
            if (!type || type === 'text') return null;
            if (['image', 'video', 'audio', 'document'].includes(type)) {
                return type as 'image' | 'video' | 'audio' | 'document';
            }
            return 'document';
        };

        return result.rows.map(row => ({
            id: String(row.id),
            body: row.content || '',
            fromMe: row.from_me,
            timestamp: new Date(row.timestamp).getTime() / 1000,
            hasMedia: row.type !== 'text' && row.type !== null,
            mediaUrl: row.media_url || null,
            mediaType: normalizeMediaType(row.media_type),
            status: (row.read ? 'read' : 'sent') as 'sent' | 'delivered' | 'read' | 'failed',
            ack: row.read ? 3 : 1
        })).reverse();
    }

    async findMessagesByPhones(phones: string[], limit: number = 50): Promise<ChatMessage[]> {
        if (phones.length === 0) return [];

        const placeholders = phones.map((_, i) => `$${i + 1}`).join(',');
        const result = await pool.query(`
            SELECT 
                id, 
                contact_phone, 
                from_me, 
                content, 
                timestamp, 
                type,
                read,
                media_url,
                media_type
            FROM messages 
            WHERE contact_phone IN (${placeholders})
            ORDER BY timestamp DESC 
            LIMIT $${phones.length + 1}
        `, [...phones, limit]);

        // Helper to normalize media type
        const normalizeMediaType = (type: string | null): 'image' | 'video' | 'audio' | 'document' | null => {
            if (!type || type === 'text') return null;
            if (['image', 'video', 'audio', 'document'].includes(type)) {
                return type as 'image' | 'video' | 'audio' | 'document';
            }
            return 'document';
        };

        return result.rows.map(row => ({
            id: String(row.id),
            body: row.content || '',
            fromMe: row.from_me,
            timestamp: new Date(row.timestamp).getTime() / 1000,
            hasMedia: row.type !== 'text' && row.type !== null,
            mediaUrl: row.media_url || null,
            mediaType: normalizeMediaType(row.media_type),
            status: (row.read ? 'read' : 'sent') as 'sent' | 'delivered' | 'read' | 'failed',
            ack: row.read ? 3 : 1
        }));
    }

    async saveMessage(data: CreateMessageDto): Promise<void> {
        try {
            const timestamp = data.timestamp || new Date();
            await pool.query(`
                INSERT INTO messages (id, contact_phone, content, from_me, type, media_url, media_type, timestamp)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO NOTHING
            `, [
                data.id,
                data.contact_phone,
                data.content,
                data.from_me,
                data.type,
                data.media_url || null,
                data.media_type || null,
                timestamp
            ]);
        } catch (error) {
            dbLogger.error('Error saving message', error);
            throw error;
        }
    }

    /**
     * Persists multiple messages in a single batch (Bulk Insert)
     * Optimized for history synchronization
     */
    async saveMessagesBulk(messages: CreateMessageDto[]): Promise<void> {
        if (messages.length === 0) return;

        try {
            // Using a simple unnest technique for Postgres bulk insert performance
            // id, contact_phone, content, from_me, type, media_url, media_type, timestamp
            const ids = messages.map(m => m.id);
            const phones = messages.map(m => m.contact_phone);
            const contents = messages.map(m => m.content);
            const fromMes = messages.map(m => m.from_me);
            const types = messages.map(m => m.type);
            const mediaUrls = messages.map(m => m.media_url || null);
            const mediaTypes = messages.map(m => m.media_type || null);
            const timestamps = messages.map(m => m.timestamp || new Date());

            await pool.query(`
                INSERT INTO messages (id, contact_phone, content, from_me, type, media_url, media_type, timestamp)
                SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::boolean[], $5::text[], $6::text[], $7::text[], $8::timestamp[])
                ON CONFLICT (id) DO NOTHING
            `, [ids, phones, contents, fromMes, types, mediaUrls, mediaTypes, timestamps]);

            dbLogger.debug(`Bulk saved ${messages.length} messages`);
        } catch (error) {
            dbLogger.error('Error in bulk saving messages', error);
            throw error;
        }
    }
}
