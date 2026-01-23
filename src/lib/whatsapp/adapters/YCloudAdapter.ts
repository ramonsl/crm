/**
 * YCloud WhatsApp Adapter
 * 
 * Implementação da interface IWhatsAppProvider para YCloud (WhatsApp Business API oficial).
 * Utiliza Webhooks para recebimento e API REST para envio.
 */

import { BaseWhatsAppAdapter } from './BaseWhatsAppAdapter';
import {
    IWhatsAppProvider,
    WhatsAppStatusResponse,
    SendMessageResult,
    MessageCallback,
    StatusCallback,
    LogCallback,
    ContactInfo,
    GroupMetadata,
    GroupParticipant,
    MediaType,
    HistorySyncCallback
} from '../IWhatsAppProvider';
import { whatsappLogger, yCloudLogger } from '@/lib/logger';

const YCLOUD_API_BASE = 'https://api.ycloud.com/v2';

interface YCloudMessageRequest {
    from: string;
    to: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'template';
    text?: { body: string };
    image?: { link: string; caption?: string };
    video?: { link: string; caption?: string };
    audio?: { link: string };
    document?: { link: string; filename?: string };
}

export class YCloudAdapter extends BaseWhatsAppAdapter implements IWhatsAppProvider {
    private apiKey: string | null = null;
    private phoneId: string | null = null;
    private status: WhatsAppStatusResponse = { status: 'disconnected' };

    private messageCallback: MessageCallback | null = null;
    private statusCallback: StatusCallback | null = null;
    private logCallback: LogCallback | null = null;

    constructor() {
        super();
        this.log('YCloud Adapter instanciado', 'info');
    }

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    async initialize(): Promise<void> {
        this.log('Inicializando YCloud Adapter...', 'info');

        try {
            const { SettingRepository } = await import('@/lib/repositories/SettingRepository');
            const settingRepo = new SettingRepository();

            const [apiKey, phoneId] = await Promise.all([
                settingRepo.get('ycloud_api_key'),
                settingRepo.get('ycloud_phone_id')
            ]);

            this.apiKey = apiKey;
            this.phoneId = phoneId;

            if (!this.apiKey || !this.phoneId) {
                this.status = {
                    status: 'disconnected',
                    error: 'YCloud não configurado: API Key ou Phone ID ausente nas configurações.'
                };
                this.log('YCloud não configurado: API Key ou Phone ID ausente', 'error');
                return;
            }

            this.status = { status: 'ready', phoneNumber: this.phoneId };
            this.log('YCloud Adapter pronto', 'success');

            if (this.statusCallback) {
                this.statusCallback(this.status);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log(`Erro ao inicializar YCloud: ${errorMsg}`, 'error');
            this.status = { status: 'disconnected', error: `Falha na inicialização: ${errorMsg}` };
            throw error;
        }
    }

    async restart(): Promise<void> {
        await this.initialize();
    }

    async logout(): Promise<void> {
        this.apiKey = null;
        this.phoneId = null;
        this.status = { status: 'disconnected' };
        this.log('YCloud Adapter desconectado', 'info');
    }

    async clearSession(autoReconnect?: boolean): Promise<void> {
        await this.logout();
        if (autoReconnect) {
            await this.initialize();
        }
    }

    // ========================================================================
    // STATUS & CONNECTION
    // ========================================================================

    async getStatus(): Promise<WhatsAppStatusResponse> {
        // Se estiver desconectado, tenta inicializar uma última vez antes de retornar status
        if (this.status.status === 'disconnected' && !this.apiKey) {
            try {
                await this.initialize();
            } catch (e) {
                // Ignore errors here, we just want to try
            }
        }
        return this.status;
    }

    async isReady(): Promise<boolean> {
        if (this.status.status === 'disconnected') {
            try {
                await this.initialize();
            } catch (e) {
                return false;
            }
        }
        return this.status.status === 'ready';
    }

    // ========================================================================
    // MESSAGING
    // ========================================================================

    async sendTextMessage(phone: string, message: string): Promise<SendMessageResult> {
        return this.sendRequest({
            from: this.phoneId!,
            to: this.normalizePhone(phone),
            type: 'text',
            text: { body: message }
        });
    }

    async sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResult> {
        return this.sendRequest({
            from: this.phoneId!,
            to: this.normalizePhone(phone),
            type: 'image',
            image: { link: imageUrl, caption }
        });
    }

    async sendVideo(phone: string, videoUrl: string, caption?: string): Promise<SendMessageResult> {
        return this.sendRequest({
            from: this.phoneId!,
            to: this.normalizePhone(phone),
            type: 'video',
            video: { link: videoUrl, caption }
        });
    }

    async sendAudio(phone: string, audioUrl: string, _ptt?: boolean): Promise<SendMessageResult> {
        return this.sendRequest({
            from: this.phoneId!,
            to: this.normalizePhone(phone),
            type: 'audio',
            audio: { link: audioUrl }
        });
    }

    async sendDocument(phone: string, documentUrl: string, filename?: string): Promise<SendMessageResult> {
        return this.sendRequest({
            from: this.phoneId!,
            to: this.normalizePhone(phone),
            type: 'document',
            document: { link: documentUrl, filename }
        });
    }

    async sendMessage(phone: string, message: string, mediaUrl?: string, mediaType?: MediaType): Promise<SendMessageResult> {
        if (!mediaUrl) {
            return this.sendTextMessage(phone, message);
        }

        switch (mediaType) {
            case 'image': return this.sendImage(phone, mediaUrl, message);
            case 'video': return this.sendVideo(phone, mediaUrl, message);
            case 'audio': return this.sendAudio(phone, mediaUrl);
            case 'document': return this.sendDocument(phone, mediaUrl, message);
            default: return this.sendTextMessage(phone, message || '[Mídia]');
        }
    }

    async syncChatHistory(_phone: string): Promise<void> {
        this.log('Sincronização de histórico não suportada para YCloud via API', 'info');
    }

    // ========================================================================
    // API HELPERS
    // ========================================================================

    private async sendRequest(payload: YCloudMessageRequest): Promise<SendMessageResult> {
        // Fetch latest credentials from DB to ensure we always use the current settings
        // This fixes the issue where the singleton instance holds onto stale/invalid credentials
        const { SettingRepository } = await import('@/lib/repositories/SettingRepository');
        const settingRepo = new SettingRepository();

        const [apiKey, phoneId, phoneNumber] = await Promise.all([
            settingRepo.get('ycloud_api_key'),
            settingRepo.get('ycloud_phone_id'),
            settingRepo.get('ycloud_phone_number')
        ]);

        if (!apiKey || !phoneId) {
            return { success: false, error: 'YCloud não configurado (API Key ou Phone ID ausente)' };
        }

        // Check if key is the masked version (security precaution)
        if (apiKey.startsWith('***')) {
            return { success: false, error: 'API Key inválida (mascarada). Por favor, reconfigure no painel.' };
        }

        // Update local state just in case, though we use local vars for the request
        this.apiKey = apiKey;
        this.phoneId = phoneId;

        // Override cached phoneId with the one from DB for consistency
        this.status = { status: 'ready', phoneNumber: phoneId };

        // CRITICAL FIX: YCloud API v2 requires the E.164 Phone Number in the 'from' field, NOT the Phone ID.
        // If we have the number stored, use it. Otherwise, try ID (which might fail).
        const sender = phoneNumber || phoneId;

        // Override the 'from' field in the payload with the correct sender
        // Clean destination number for E.164 compliance
        let dest = payload.to.replace(/\D/g, '');
        // BASIC NORMALIZATION: If number has 10 or 11 digits (e.g. 51981636027), assume BR and add 55.
        // YCloud interprets "51..." as Peru (+51) if we don't fix it.
        if (dest.length >= 10 && dest.length <= 11) {
            dest = '55' + dest;
            this.log(`[Adapter] Auto-formatted destination: ${payload.to} -> ${dest}`, 'info');
        }

        const finalPayload = {
            ...payload,
            from: sender,
            to: dest
        };

        // DEBUG LOGGING
        this.log(`[DEBUG] Attempting send. Sender: '${sender}' | KeyLength: ${apiKey.length} | To: '${finalPayload.to}'`, 'info');
        console.log('[DEBUG-YCLOUD-KEY]', JSON.stringify(apiKey));

        try {
            const response = await fetch(`${YCLOUD_API_BASE}/whatsapp/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey.trim() // Force trim just in case
                },
                body: JSON.stringify(finalPayload)
            });

            const data = await response.json();

            if (!response.ok) {
                // Log full error details
                console.error('[YCloud API Error Response]', JSON.stringify(data, null, 2));

                const error = data.error?.message || `Erro API YCloud: ${response.status}`;

                // Check for specific error codes related to conversation window (structure unavailable / conversation expired)
                // YCloud/Meta often returns "StructureUnavailable" or subcode 131047 for > 24h window
                if (data.error?.code === 131047 || data.error?.type === 'OAuthException') { // OAuthException is generic but common for permissions
                    return { success: false, error: 'outside_window' };
                }

                this.log(`Erro ao enviar mensagem: ${error} (Code: ${data.error?.code})`, 'error');
                return { success: false, error };
            }

            this.log(`Mensagem enviada com sucesso! ID: ${data.id}`, 'success');
            return { success: true, messageId: data.id };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log(`Exceção ao enviar mensagem: ${errorMsg}`, 'error');
            return { success: false, error: errorMsg };
        }
    }

    private normalizePhone(phone: string): string {
        let cleaned = phone.replace(/\D/g, '');
        if (!cleaned.startsWith('55')) {
            cleaned = '55' + cleaned;
        }
        return cleaned;
    }

    // ========================================================================
    // CONTACTS & PROFILE
    // ========================================================================

    async getProfilePicture(_phone: string): Promise<string | null> {
        return null; // YCloud não expõe via API simples
    }

    async validateNumber(phone: string): Promise<string | null> {
        return this.normalizePhone(phone);
    }

    async getContactInfo(_phone: string): Promise<ContactInfo | null> {
        return null;
    }

    // ========================================================================
    // GROUPS
    // ========================================================================

    async listGroups(): Promise<GroupMetadata[]> {
        return []; // YCloud Business API não foca em grupos via Webhooks/API simples
    }

    async getGroupParticipants(_groupId: string): Promise<GroupParticipant[]> {
        return [];
    }

    async isNumberInGroup(_phone: string, _groupId: string): Promise<boolean> {
        return false;
    }

    // ========================================================================
    // EVENTS
    // ========================================================================

    onMessage(callback: MessageCallback): void {
        this.messageCallback = callback;
    }

    onStatusChange(callback: StatusCallback): void {
        this.statusCallback = callback;
    }

    offMessage(): void {
        this.messageCallback = null;
    }

    offStatusChange(): void {
        this.statusCallback = null;
    }

    onLog(callback: LogCallback): void {
        this.logCallback = callback;
    }

    offLog(): void {
        this.logCallback = null;
    }

    onHistorySync(_callback: HistorySyncCallback): void {
        // Not supported
    }

    offHistorySync(): void {
        // Not supported
    }

    private log(message: string, type: 'info' | 'success' | 'error'): void {
        const fullMessage = `[YCloud] ${message}`;
        if (type === 'error') yCloudLogger.error(message);
        else yCloudLogger.info(message);

        if (this.logCallback) {
            this.logCallback(fullMessage, type);
        }
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    getProviderName(): string {
        return 'ycloud';
    }

    getProviderVersion(): string {
        return '2.0.0';
    }

    // Abstract methods from BaseWhatsAppAdapter
    protected async verifyJidOnNetwork(_jid: string): Promise<string | null> {
        return null; // Remote API handles this
    }

    protected formatToDefaultJid(number: string): string {
        return number; // 공식 API는 JID 대신 폰 번호 사용
    }

    /**
     * PUBLIC METHOD para ser chamado pelo WebhookService
     */
    public pushInboundMessage(message: any): void {
        if (this.messageCallback) {
            this.messageCallback({
                from: message.from,
                body: message.text?.body || '[Mídia]',
                isGroup: false,
                timestamp: new Date(),
                fromMe: false,
                id: message.id,
                mediaUrl: message.image?.link || message.video?.link || message.audio?.link || message.document?.link,
                mediaType: message.type as MediaType
            });
        }
    }
}
