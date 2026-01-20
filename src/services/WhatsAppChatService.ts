/**
 * WhatsApp Chat Service
 * 
 * Serviço responsável por buscar conversas e mensagens do WhatsApp.
 * Utiliza o banco de dados como fonte principal (compatível com todos os providers).
 * 
 * Seguindo Single Responsibility Principle (SOLID)
 */

import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory/WhatsAppProviderFactory';
import { pool } from '@/lib/db';
import { chatLogger } from '@/lib/logger';

// ============================================================================
// INTERFACES
// ============================================================================

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

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class WhatsAppChatService {
    /**
     * Verifica se o provider está pronto para operações
     */
    async isReady(): Promise<boolean> {
        try {
            const provider = await WhatsAppProviderFactory.getProvider();
            return provider.isReady();
        } catch {
            return false;
        }
    }

    /**
     * Busca todas as conversas do banco de dados
     * Independente do provider usado, a fonte de dados é o DB
     */
    async getAllChats(_includeGroups: boolean = false): Promise<ChatInfo[]> {
        chatLogger.debug('Buscando conversas do banco de dados...');

        try {
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

            chatLogger.debug(`Encontradas ${result.rows.length} conversas`);

            return result.rows.map(row => ({
                id: this.buildChatId(row.telefone),
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
        } catch (error) {
            chatLogger.error('Erro ao buscar conversas:', error);
            throw error;
        }
    }

    /**
     * Busca mensagens de uma conversa específica
     */
    async getChatMessages(chatId: string, limit: number = 50): Promise<ChatMessage[]> {
        const phone = this.extractPhoneFromChatId(chatId);

        chatLogger.debug(`Buscando mensagens para telefone: ${phone}`);

        try {
            // Primeiro, encontra o CPF do lead pelo telefone
            const leadResult = await pool.query(
                'SELECT cpf FROM leads WHERE telefone LIKE $1 LIMIT 1',
                [`%${phone.slice(-8)}`]
            );

            const leadCpf = leadResult.rows[0]?.cpf;

            if (!leadCpf) {
                chatLogger.warn(`Lead não encontrado para chat ${chatId}`);
                return [];
            }

            // Busca mensagens usando o CPF (padrão legado da tabela messages)
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
            `, [leadCpf, limit]);

            chatLogger.debug(`Encontradas ${result.rows.length} mensagens`);

            // Retorna em ordem cronológica (mais antiga primeiro)
            return result.rows.map(row => ({
                id: String(row.id),
                body: row.content || '',
                fromMe: row.from_me,
                timestamp: new Date(row.timestamp).getTime() / 1000,
                hasMedia: row.type !== 'text' && row.type !== null,
                mediaUrl: row.media_url || null,
                mediaType: this.normalizeMediaType(row.media_type),
                status: this.mapReadStatus(row.read),
                ack: row.read ? 3 : 1
            })).reverse();
        } catch (error) {
            chatLogger.error('Erro ao buscar mensagens:', error);
            throw error;
        }
    }

    /**
     * Marca conversa como lida
     * Nota: Funcionalidade desabilitada temporariamente devido a instabilidade
     */
    async markAsRead(chatId: string): Promise<void> {
        chatLogger.debug(`markAsRead chamado para ${chatId} (funcionalidade desabilitada)`);
        // TODO: Implementar via provider quando estabilizado
        return;
    }

    // ========================================================================
    // HELPERS PRIVADOS
    // ========================================================================

    private buildChatId(phone: string): string {
        const normalized = phone.replace(/\D/g, '');
        return `${normalized}@s.whatsapp.net`;
    }

    private extractPhoneFromChatId(chatId: string): string {
        return chatId.replace(/\D/g, '');
    }

    private normalizeMediaType(type: string | null): 'image' | 'video' | 'audio' | 'document' | null {
        if (!type || type === 'text') return null;
        if (['image', 'video', 'audio', 'document'].includes(type)) {
            return type as 'image' | 'video' | 'audio' | 'document';
        }
        return 'document'; // fallback para tipos desconhecidos
    }

    private mapReadStatus(read: boolean | null): 'sent' | 'delivered' | 'read' | 'failed' {
        return read ? 'read' : 'sent';
    }
}

// Singleton export
export const whatsAppChatService = new WhatsAppChatService();
