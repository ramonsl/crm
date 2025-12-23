"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppGroups = void 0;
const logger_1 = require("../../lib/logger");
const validation_1 = require("./validation");
class WhatsAppGroups {
    constructor(state) {
        this.state = state;
        this.validator = new validation_1.WhatsAppValidator(state);
    }
    /**
     * Ensure client is ready, throw if not
     */
    ensureClientReady() {
        if (!this.state.client) {
            const errorMsg = `WhatsApp client is not initialized. Status: ${this.state.status}`;
            logger_1.whatsappLogger.error(` ${errorMsg}`);
            throw new Error('WhatsApp client is not ready');
        }
        if (this.state.status !== 'ready') {
            const errorMsg = `WhatsApp is not in ready state. Current status: ${this.state.status}`;
            logger_1.whatsappLogger.error(` ${errorMsg}`);
            throw new Error('WhatsApp client is not ready');
        }
    }
    /**
     * List all available groups
     */
    async listAll() {
        logger_1.whatsappLogger.debug(' Listando todos os grupos');
        this.ensureClientReady();
        try {
            // Additional check before using client
            if (!this.state.client) {
                throw new Error('WhatsApp client became undefined before executing getChats');
            }
            const chats = await this.state.client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            const groupList = groups.map(group => {
                var _a;
                return ({
                    id: group.id._serialized,
                    name: group.name,
                    participantCount: ((_a = group.participants) === null || _a === void 0 ? void 0 : _a.length) || 0
                });
            });
            logger_1.whatsappLogger.debug(` Total de grupos: ${groupList.length}`);
            return groupList;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorString = String(error);
            // Detect Puppeteer/WhatsApp Client specific errors
            if (errorString.includes('Cannot read properties of undefined') ||
                errorString.includes('pptr://') ||
                errorString.includes('evaluation_script')) {
                logger_1.whatsappLogger.error(' Cliente WhatsApp foi destruído ou está em estado inválido');
                throw new Error('WhatsApp client is not ready');
            }
            logger_1.whatsappLogger.error(` Erro ao listar grupos: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Get all participants from a specific group
     */
    async getParticipants(groupId) {
        logger_1.whatsappLogger.debug(` Obtendo participantes do grupo ${groupId}`);
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
            }
            else {
                targetGroup = groups.find(g => g.name.toLowerCase().includes(groupId.toLowerCase()));
            }
            if (!targetGroup) {
                logger_1.whatsappLogger.warn(` Grupo não encontrado: ${groupId}`);
                throw new Error(`Group not found: ${groupId}`);
            }
            const chat = await this.state.client.getChatById(targetGroup.id._serialized);
            const participants = chat.participants || [];
            const participantList = participants.map((p) => ({
                phone: p.id.user,
                isAdmin: p.isAdmin || false,
                name: p.id.user // Library doesn't provide name directly
            }));
            logger_1.whatsappLogger.debug(` Total de participantes no grupo ${targetGroup.name}: ${participantList.length}`);
            return participantList;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorString = String(error);
            if (errorString.includes('Cannot read properties of undefined') ||
                errorString.includes('pptr://') ||
                errorString.includes('evaluation_script')) {
                logger_1.whatsappLogger.error(' Cliente WhatsApp foi destruído ou está em estado inválido');
                throw new Error('WhatsApp client is not ready');
            }
            logger_1.whatsappLogger.error(` Erro ao obter participantes do grupo: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Check if a phone number is in a specific group
     */
    async isNumberInGroup(phone, groupId) {
        logger_1.whatsappLogger.debug(` Verificando se ${phone} está no grupo ${groupId}`);
        this.ensureClientReady();
        try {
            const formattedPhone = this.validator.normalizePhone(phone);
            if (!this.state.client) {
                throw new Error('WhatsApp client became undefined before executing getChats');
            }
            // Get all groups
            logger_1.whatsappLogger.debug(' Obtendo lista de chats...');
            const chats = await this.state.client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            logger_1.whatsappLogger.debug(` Total de grupos encontrados: ${groups.length}`);
            // Find the specific group
            let targetGroup = null;
            if (groupId.endsWith('@g.us')) {
                targetGroup = groups.find(g => g.id._serialized === groupId);
            }
            else {
                targetGroup = groups.find(g => g.name.toLowerCase().includes(groupId.toLowerCase()));
            }
            if (!targetGroup) {
                logger_1.whatsappLogger.warn(` Grupo não encontrado: ${groupId}`);
                throw new Error(`Group not found: ${groupId}`);
            }
            logger_1.whatsappLogger.debug(` Grupo encontrado: ${targetGroup.name} (${targetGroup.id._serialized})`);
            // Get group participants
            const chat = await this.state.client.getChatById(targetGroup.id._serialized);
            const participants = chat.participants || [];
            logger_1.whatsappLogger.debug(` Total de participantes no grupo: ${participants.length}`);
            // Create variations of the number to check
            const variations = this.validator.getPhoneVariations(phone);
            logger_1.whatsappLogger.debug(` Verificando variações: ${variations.join(', ')}`);
            // Check if any variation is in the participants
            for (const variation of variations) {
                const isInGroup = participants.some((p) => {
                    const participantNumber = p.id.user;
                    return participantNumber === variation;
                });
                if (isInGroup) {
                    logger_1.whatsappLogger.debug(` ✓ Número ${phone} encontrado no grupo ${targetGroup.name} (variação: ${variation})`);
                    return true;
                }
            }
            logger_1.whatsappLogger.debug(` ✗ Número ${phone} NÃO está no grupo ${targetGroup.name}`);
            return false;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorString = String(error);
            if (errorString.includes('Cannot read properties of undefined') ||
                errorString.includes('pptr://') ||
                errorString.includes('evaluation_script')) {
                logger_1.whatsappLogger.error(' Cliente WhatsApp foi destruído ou está em estado inválido');
                throw new Error('WhatsApp client is not ready');
            }
            logger_1.whatsappLogger.error(` Erro ao verificar número no grupo: ${errorMessage}`);
            throw error;
        }
    }
}
exports.WhatsAppGroups = WhatsAppGroups;
