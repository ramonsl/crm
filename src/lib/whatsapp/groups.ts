import { whatsappLogger } from '@/lib/logger';

/**
 * WhatsApp Groups - Group Operations
 * 
 * Handles all WhatsApp group-related operations:
 * - Listing groups
 * - Getting participants
 * - Checking if a number is in a group
 * 
 * Following:
 * - SRP: Only handles group operations
 * - DIP: Depends on state abstraction
 */

import type { WhatsAppStateManager } from './state';
import type { GroupInfo, GroupParticipant, GroupChat } from './types';
import { WhatsAppValidator } from './validation';

export class WhatsAppGroups {
    private validator: WhatsAppValidator;

    constructor(private state: WhatsAppStateManager) {
        this.validator = new WhatsAppValidator(state);
    }

    /**
     * Ensure client is ready, throw if not
     */
    private ensureClientReady(): void {
        if (!this.state.client) {
            const errorMsg = `WhatsApp client is not initialized. Status: ${this.state.status}`;
            whatsappLogger.error(` ${errorMsg}`);
            throw new Error('WhatsApp client is not ready');
        }

        if (this.state.status !== 'ready') {
            const errorMsg = `WhatsApp is not in ready state. Current status: ${this.state.status}`;
            whatsappLogger.error(` ${errorMsg}`);
            throw new Error('WhatsApp client is not ready');
        }
    }

    /**
     * List all available groups
     */
    async listAll(): Promise<GroupInfo[]> {
        whatsappLogger.debug(' Listando todos os grupos');
        this.ensureClientReady();

        try {
            // Additional check before using client
            if (!this.state.client) {
                throw new Error('WhatsApp client became undefined before executing getChats');
            }

            const chats = await this.state.client.getChats();
            const groups = chats.filter(chat => chat.isGroup);

            const groupList = groups.map(group => ({
                id: group.id._serialized,
                name: group.name,
                participantCount: (group as GroupChat).participants?.length || 0
            }));

            whatsappLogger.debug(` Total de grupos: ${groupList.length}`);
            return groupList;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorString = String(error);

            // Detect Puppeteer/WhatsApp Client specific errors
            if (errorString.includes('Cannot read properties of undefined') ||
                errorString.includes('pptr://') ||
                errorString.includes('evaluation_script')) {
                whatsappLogger.error(' Cliente WhatsApp foi destruído ou está em estado inválido');
                throw new Error('WhatsApp client is not ready');
            }

            whatsappLogger.error(` Erro ao listar grupos: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Get all participants from a specific group
     */
    async getParticipants(groupId: string): Promise<GroupParticipant[]> {
        whatsappLogger.debug(` Obtendo participantes do grupo ${groupId}`);
        this.ensureClientReady();

        try {
            if (!this.state.client) {
                throw new Error('WhatsApp client became undefined before executing getChats');
            }

            const chats = await this.state.client.getChats();
            const groups = chats.filter(chat => chat.isGroup);

            // Find the group
            let targetGroup = null;
            if (groupId.endsWith('@g.us')) {
                targetGroup = groups.find(g => g.id._serialized === groupId);
            } else {
                targetGroup = groups.find(g => g.name.toLowerCase().includes(groupId.toLowerCase()));
            }

            if (!targetGroup) {
                whatsappLogger.warn(` Grupo não encontrado: ${groupId}`);
                throw new Error(`Group not found: ${groupId}`);
            }

            const chat = await this.state.client.getChatById(targetGroup.id._serialized) as GroupChat;
            const participants = chat.participants || [];

            const participantList = participants.map((p: { id: { user: string }; isAdmin?: boolean }) => ({
                phone: p.id.user,
                isAdmin: p.isAdmin || false,
                name: p.id.user // Library doesn't provide name directly
            }));

            whatsappLogger.debug(` Total de participantes no grupo ${targetGroup.name}: ${participantList.length}`);
            return participantList;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorString = String(error);

            if (errorString.includes('Cannot read properties of undefined') ||
                errorString.includes('pptr://') ||
                errorString.includes('evaluation_script')) {
                whatsappLogger.error(' Cliente WhatsApp foi destruído ou está em estado inválido');
                throw new Error('WhatsApp client is not ready');
            }

            whatsappLogger.error(` Erro ao obter participantes do grupo: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Check if a phone number is in a specific group
     */
    async isNumberInGroup(phone: string, groupId: string): Promise<boolean> {
        whatsappLogger.debug(` Verificando se ${phone} está no grupo ${groupId}`);
        this.ensureClientReady();

        try {
            const formattedPhone = this.validator.normalizePhone(phone);

            if (!this.state.client) {
                throw new Error('WhatsApp client became undefined before executing getChats');
            }

            // Get all groups
            whatsappLogger.debug(' Obtendo lista de chats...');
            const chats = await this.state.client.getChats();
            const groups = chats.filter(chat => chat.isGroup);

            whatsappLogger.debug(` Total de grupos encontrados: ${groups.length}`);

            // Find the specific group
            let targetGroup = null;

            if (groupId.endsWith('@g.us')) {
                targetGroup = groups.find(g => g.id._serialized === groupId);
            } else {
                targetGroup = groups.find(g => g.name.toLowerCase().includes(groupId.toLowerCase()));
            }

            if (!targetGroup) {
                whatsappLogger.warn(` Grupo não encontrado: ${groupId}`);
                throw new Error(`Group not found: ${groupId}`);
            }

            whatsappLogger.debug(` Grupo encontrado: ${targetGroup.name} (${targetGroup.id._serialized})`);

            // Get group participants
            const chat = await this.state.client.getChatById(targetGroup.id._serialized) as GroupChat;
            const participants = chat.participants || [];

            whatsappLogger.debug(` Total de participantes no grupo: ${participants.length}`);

            // Create variations of the number to check
            const variations = this.validator.getPhoneVariations(phone);
            whatsappLogger.debug(` Verificando variações: ${variations.join(', ')}`);

            // Check if any variation is in the participants
            for (const variation of variations) {
                const isInGroup = participants.some((p: { id: { user: string } }) => {
                    const participantNumber = p.id.user;
                    return participantNumber === variation;
                });

                if (isInGroup) {
                    whatsappLogger.debug(` ✓ Número ${phone} encontrado no grupo ${targetGroup.name} (variação: ${variation})`);
                    return true;
                }
            }

            whatsappLogger.debug(` ✗ Número ${phone} NÃO está no grupo ${targetGroup.name}`);
            return false;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorString = String(error);

            if (errorString.includes('Cannot read properties of undefined') ||
                errorString.includes('pptr://') ||
                errorString.includes('evaluation_script')) {
                whatsappLogger.error(' Cliente WhatsApp foi destruído ou está em estado inválido');
                throw new Error('WhatsApp client is not ready');
            }

            whatsappLogger.error(` Erro ao verificar número no grupo: ${errorMessage}`);
            throw error;
        }
    }
}
