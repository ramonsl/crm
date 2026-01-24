/**
 * WhatsApp Chat Service
 * 
 * Serviço responsável por buscar conversas e mensagens do WhatsApp.
 * Utiliza o banco de dados como fonte principal (compatível com todos os providers).
 * Agora suporta envio híbrido via WhatsAppProviderManager.
 * 
 * Seguindo Single Responsibility Principle (SOLID)
 */

import { WhatsAppProviderManager } from '@/lib/whatsapp/manager/WhatsAppProviderManager';
import { chatLogger } from '@/lib/logger';
import { WhatsAppRepository, LeadRepository } from '@/lib/repositories';

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

export interface SendMessageOptions {
    previewUrl?: boolean;
    quotedMessageId?: string;
    provider?: 'ycloud' | 'baileys' | 'wwebjs';
    templateId?: string;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class WhatsAppChatService {
    private whatsAppRepository: WhatsAppRepository;
    private leadRepository: LeadRepository;
    private providerManager: WhatsAppProviderManager;

    constructor() {
        this.whatsAppRepository = new WhatsAppRepository();
        this.leadRepository = new LeadRepository();
        this.providerManager = WhatsAppProviderManager.getInstance();
    }

    /**
     * Verifica se o provider está pronto para operações
     */
    async isReady(type?: 'ycloud' | 'baileys' | 'wwebjs'): Promise<boolean> {
        try {
            if (type === 'ycloud') {
                return this.providerManager.isOfficialReady();
            }
            // If explicit web type or unspecified (default web)
            return this.providerManager.isWebReady();
        } catch {
            return false;
        }
    }

    /**
     * Busca todas as conversas do banco de dados
     * Independente do provider usado, a fonte de dados é o DB
     */
    async getAllChats(includeGroups: boolean = false): Promise<ChatInfo[]> {
        chatLogger.debug('Buscando conversas do banco de dados...');

        try {
            const chats = await this.whatsAppRepository.findAllChats();
            chatLogger.debug(`Encontradas ${chats.length} conversas`);
            return chats;
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
            const lead = await this.leadRepository.findByPhone(phone);

            if (!lead || !lead.cpf) {
                chatLogger.warn(`Lead não encontrado para chat ${chatId}`);
                return [];
            }

            // Busca mensagens usando o CPF (padrão legado da tabela messages)
            const messages = await this.whatsAppRepository.findMessagesByCpf(lead.cpf, limit);

            chatLogger.debug(`Encontradas ${messages.length} mensagens`);

            return messages;
        } catch (error) {
            chatLogger.error('Erro ao buscar mensagens:', error);
            throw error;
        }
    }

    /**
     * Send a text message with provider selection
     */
    async sendTextMessage(phone: string, message: string, options?: SendMessageOptions): Promise<void> {
        chatLogger.info(`Sending message to ${phone} via ${options?.provider || 'default (web)'}`);

        try {
            const providerType = options?.provider || 'baileys';
            const provider = await this.providerManager.getProvider(providerType);

            await provider.sendTextMessage(phone, message);

            // Log is handled by provider adapter usually, but we could add extra Db storage here if needed
            // The Repository logic for saving sent messages should ideally be hooked into the Provider's event 
            // or handled here if we want immediate feedback.
            // For now, we rely on the Adapter/Provider emitting the 'message' event which is captured and saved.
        } catch (error) {
            chatLogger.error('Error sending message:', error);
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

    private extractPhoneFromChatId(chatId: string): string {
        return chatId.replace(/\D/g, '');
    }
}

// Singleton export
export const whatsAppChatService = new WhatsAppChatService();
