/**
 * WuzAPI WhatsApp Adapter
 *
 * Implementa IWhatsAppProvider usando WuzAPI (https://github.com/asternic/wuzapi)
 * WuzAPI é um servidor HTTP que encapsula Baileys, expondo uma API REST estável
 * e gerenciando reconexões automaticamente — mais resiliente que Baileys direto.
 *
 * Configuração necessária (Settings ou env vars):
 *   wuzapi_url   → URL base do servidor WuzAPI, ex: http://localhost:8080
 *   wuzapi_token → Token de autenticação do WuzAPI
 *
 * Mensagens recebidas chegam via webhook: POST /api/wuzapi/webhook
 * O WuzAPI deve ser configurado com WUZAPI_WEBHOOK_URL apontando para este endpoint.
 */

import { BaseWhatsAppAdapter } from './BaseWhatsAppAdapter';
import { whatsappLogger } from '@/lib/logger';
import type {
    IWhatsAppProvider,
    WhatsAppMessage,
    WhatsAppStatusResponse,
    SendMessageResult,
    ContactInfo,
    GroupMetadata,
    GroupParticipant,
    MediaType,
    MessageCallback,
    StatusCallback,
    LogCallback,
    HistorySyncCallback,
} from '../IWhatsAppProvider';

// ---------------------------------------------------------------------------
// WuzAPI Response shapes (as documented in github.com/asternic/wuzapi)
// ---------------------------------------------------------------------------

interface WuzAPIStatusResponse {
    data?: {
        Connected?: boolean;
        LoggedIn?: boolean;
    };
}

interface WuzAPIQrResponse {
    data?: {
        QRCode?: string; // base64 PNG
    };
}

interface WuzAPISendResponse {
    data?: {
        Id?: string;
    };
}

interface WuzAPIGroupEntry {
    Id: string;
    Name: string;
    Participants?: Array<{
        JID: string;
        IsAdmin: boolean;
        IsSuperAdmin: boolean;
    }>;
}

interface WuzAPIGroupsResponse {
    data?: WuzAPIGroupEntry[];
}

// Webhook payload sent by WuzAPI to our endpoint
export interface WuzAPIWebhookPayload {
    event: string;       // "Message" | "ReadReceipt" | "Presence" | ...
    instanceId?: number;
    token?: string;
    data?: {
        Id?: string;
        Body?: string;
        Type?: string;          // "text" | "image" | ...
        Timestamp?: number;
        Sender?: string;        // "5511...@s.whatsapp.net"
        GroupId?: string | null;// "123...@g.us"
        IsGroup?: boolean;
        FromMe?: boolean;
        PushName?: string;
        Forwarded?: boolean;
        MimeType?: string;
        Caption?: string;
        MediaUrl?: string;
    };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class WuzAPIAdapter extends BaseWhatsAppAdapter implements IWhatsAppProvider {
    private baseUrl: string | null = null;
    private token: string | null = null;
    private _status: WhatsAppStatusResponse = { status: 'disconnected' };

    private messageCallback: MessageCallback | null = null;
    private statusCallback: StatusCallback | null = null;
    private logCallback: LogCallback | null = null;
    private historySyncCallback: HistorySyncCallback | null = null;

    constructor() {
        super();
    }

    // =========================================================================
    // PUBLIC: called by webhook route to dispatch an incoming message
    // =========================================================================

    dispatchWebhookPayload(payload: WuzAPIWebhookPayload): void {
        const { event, data } = payload;
        if (event !== 'Message' || !data) return;
        if (data.FromMe) return; // Ignore own messages

        const from = data.IsGroup
            ? (data.GroupId ?? data.Sender ?? '')
            : (data.Sender ?? '');

        const message: WhatsAppMessage = {
            id: data.Id ?? `wuzapi-${Date.now()}`,
            from,
            body: data.Body ?? '',
            isGroup: !!data.IsGroup,
            timestamp: data.Timestamp ? new Date(data.Timestamp * 1000) : new Date(),
            fromMe: !!data.FromMe,
            mediaUrl: data.MediaUrl ?? undefined,
            mediaType: this.mapMediaType(data.Type),
        };

        if (this.messageCallback) {
            this.messageCallback(message);
        }
    }

    private mapMediaType(type?: string): MediaType | undefined {
        if (!type) return undefined;
        const t = type.toLowerCase();
        if (t.includes('image')) return 'image';
        if (t.includes('video')) return 'video';
        if (t.includes('audio') || t.includes('ptt')) return 'audio';
        if (t.includes('document')) return 'document';
        return undefined;
    }

    // =========================================================================
    // LIFECYCLE
    // =========================================================================

    async initialize(): Promise<void> {
        this.log('Inicializando WuzAPI Adapter...', 'info');

        try {
            const { SettingRepository } = await import('@/lib/repositories/SettingRepository');
            const repo = new SettingRepository();

            const [url, token] = await Promise.all([
                repo.get('wuzapi_url'),
                repo.get('wuzapi_token'),
            ]);

            this.baseUrl = url || process.env.WUZAPI_URL || null;
            this.token  = token || process.env.WUZAPI_TOKEN || null;

            if (!this.baseUrl || !this.token) {
                this._status = {
                    status: 'disconnected',
                    error: 'WuzAPI não configurado: defina wuzapi_url e wuzapi_token nas Configurações.',
                };
                this.log('WuzAPI não configurado', 'error');
                return;
            }

            // Verify connectivity
            const s = await this.fetchRemoteStatus();
            this._status = s;
            this.log(`WuzAPI status: ${s.status}`, s.status === 'ready' ? 'success' : 'info');

            if (this.statusCallback) this.statusCallback(s);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this._status = { status: 'disconnected', error: `Falha ao conectar ao WuzAPI: ${msg}` };
            this.log(`Erro na inicialização: ${msg}`, 'error');
        }
    }

    async restart(): Promise<void> {
        if (!this.baseUrl || !this.token) {
            await this.initialize();
            return;
        }
        this.log('Reiniciando sessão WuzAPI...', 'info');
        try {
            await this.post('/session/disconnect', {});
            await new Promise(r => setTimeout(r, 1000));
            await this.post('/session/connect', {});
        } catch {
            // Best-effort
        }
        // Poll for readiness up to 30s
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const s = await this.fetchRemoteStatus();
            if (s.status === 'ready') {
                this._status = s;
                if (this.statusCallback) this.statusCallback(s);
                return;
            }
            if (s.status === 'qr') {
                this._status = s;
                if (this.statusCallback) this.statusCallback(s);
                return;
            }
        }
    }

    async logout(): Promise<void> {
        if (this.baseUrl && this.token) {
            await this.post('/session/disconnect', {}).catch(() => {});
        }
        this._status = { status: 'disconnected' };
        this.baseUrl = null;
        this.token = null;
        this.log('WuzAPI desconectado', 'info');
    }

    async clearSession(autoReconnect = false): Promise<void> {
        await this.logout();
        if (autoReconnect) await this.initialize();
    }

    // =========================================================================
    // STATUS
    // =========================================================================

    async getStatus(): Promise<WhatsAppStatusResponse> {
        if (!this.baseUrl || !this.token) return this._status;
        try {
            this._status = await this.fetchRemoteStatus();
        } catch {
            // Keep last known status
        }
        return this._status;
    }

    async isReady(): Promise<boolean> {
        const s = await this.getStatus();
        return s.status === 'ready';
    }

    private async fetchRemoteStatus(): Promise<WhatsAppStatusResponse> {
        try {
            const res = await this.get<WuzAPIStatusResponse>('/session/status');

            if (res?.data?.Connected && res?.data?.LoggedIn) {
                return { status: 'ready' };
            }

            // Try to get QR code
            try {
                const qr = await this.get<WuzAPIQrResponse>('/user/qrcode');
                if (qr?.data?.QRCode) {
                    return { status: 'qr', qrCode: qr.data.QRCode };
                }
            } catch {
                // Ignore QR fetch errors
            }

            return { status: 'connecting' };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { status: 'disconnected', error: `WuzAPI inacessível: ${msg}` };
        }
    }

    // =========================================================================
    // MESSAGING
    // =========================================================================

    async sendTextMessage(phone: string, message: string): Promise<SendMessageResult> {
        return this.sendWuzAPI('/chat/send/text', { Phone: this.normalizePhone(phone), Body: message });
    }

    async sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResult> {
        return this.sendWuzAPI('/chat/send/image', {
            Phone: this.normalizePhone(phone), Image: imageUrl, Caption: caption ?? '',
        });
    }

    async sendVideo(phone: string, videoUrl: string, caption?: string): Promise<SendMessageResult> {
        return this.sendWuzAPI('/chat/send/video', {
            Phone: this.normalizePhone(phone), Video: videoUrl, Caption: caption ?? '',
        });
    }

    async sendAudio(phone: string, audioUrl: string, _ptt?: boolean): Promise<SendMessageResult> {
        return this.sendWuzAPI('/chat/send/audio', { Phone: this.normalizePhone(phone), Audio: audioUrl });
    }

    async sendDocument(phone: string, documentUrl: string, filename?: string): Promise<SendMessageResult> {
        return this.sendWuzAPI('/chat/send/document', {
            Phone: this.normalizePhone(phone), Document: documentUrl, FileName: filename ?? 'documento',
        });
    }

    /**
     * Normaliza o phone/JID para o formato esperado pelo WuzAPI:
     * - Grupos: mantém o JID completo "1234@g.us"
     * - Pessoas: remove "@s.whatsapp.net", deixa só o número
     */
    private normalizePhone(phone: string): string {
        if (phone.endsWith('@g.us')) return phone;               // grupo → mantém
        return phone.replace(/@s\.whatsapp\.net$/, '');          // DM → só o número
    }

    async sendMessage(
        phone: string, message: string, mediaUrl?: string, mediaType?: MediaType,
    ): Promise<SendMessageResult> {
        if (!mediaUrl) return this.sendTextMessage(phone, message);
        switch (mediaType) {
            case 'image':    return this.sendImage(phone, mediaUrl, message);
            case 'video':    return this.sendVideo(phone, mediaUrl, message);
            case 'audio':    return this.sendAudio(phone, mediaUrl);
            case 'document': return this.sendDocument(phone, mediaUrl, message);
            default:         return this.sendTextMessage(phone, message || '[Mídia]');
        }
    }

    async syncChatHistory(_phone: string): Promise<void> {
        // WuzAPI não expõe history sync por demanda
    }

    // =========================================================================
    // CONTACTS & PROFILE
    // =========================================================================

    async getProfilePicture(_phone: string): Promise<string | null> { return null; }
    async validateNumber(phone: string): Promise<string | null>     { return phone; }
    async getContactInfo(_phone: string): Promise<ContactInfo | null> { return null; }

    // =========================================================================
    // GROUPS
    // =========================================================================

    async listGroups(): Promise<GroupMetadata[]> {
        if (!this.baseUrl || !this.token) return [];
        try {
            const res = await this.get<WuzAPIGroupsResponse>('/group/list');
            return (res?.data ?? []).map(g => ({
                id: g.Id,
                subject: g.Name,
                participants: (g.Participants ?? []).map(p => ({
                    id: p.JID,
                    admin: p.IsAdmin,
                    superAdmin: p.IsSuperAdmin,
                })),
            }));
        } catch (err) {
            whatsappLogger.warn('[WuzAPI] listGroups failed:', err);
            return [];
        }
    }

    async getGroupParticipants(groupId: string): Promise<GroupParticipant[]> {
        const groups = await this.listGroups();
        return groups.find(g => g.id === groupId)?.participants ?? [];
    }

    async isNumberInGroup(phone: string, groupId: string): Promise<boolean> {
        const participants = await this.getGroupParticipants(groupId);
        const clean = phone.replace(/\D/g, '');
        return participants.some(p => p.id.includes(clean));
    }

    // =========================================================================
    // EVENTS
    // =========================================================================

    onMessage(callback: MessageCallback): void        { this.messageCallback = callback; }
    onStatusChange(callback: StatusCallback): void    { this.statusCallback = callback; }
    offMessage(): void                                { this.messageCallback = null; }
    offStatusChange(): void                           { this.statusCallback = null; }
    onLog(callback: LogCallback): void                { this.logCallback = callback; }
    offLog(): void                                    { this.logCallback = null; }
    onHistorySync(callback: HistorySyncCallback): void { this.historySyncCallback = callback; }
    offHistorySync(): void                            { this.historySyncCallback = null; }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    getProviderName(): string    { return 'WuzAPI'; }
    getProviderVersion(): string { return '1.0.0'; }

    protected async verifyJidOnNetwork(_jid: string): Promise<string | null> {
        return null; // WuzAPI não expõe verificação de número
    }

    protected formatToDefaultJid(number: string): string {
        return `${number}@s.whatsapp.net`;
    }

    private log(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
        if (this.logCallback) this.logCallback(message, type);
        whatsappLogger[type === 'error' ? 'error' : 'info'](`[WuzAPI] ${message}`);
    }

    // =========================================================================
    // HTTP HELPERS
    // =========================================================================

    private headers(): HeadersInit {
        return {
            'Content-Type': 'application/json',
            'Authorization': this.token!,
        };
    }

    private async get<T>(path: string): Promise<T> {
        const res = await fetch(`${this.baseUrl}${path}`, {
            headers: this.headers(),
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
        return res.json() as Promise<T>;
    }

    private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`POST ${path} → HTTP ${res.status}: ${text}`);
        }
        return res.json() as Promise<T>;
    }

    private async sendWuzAPI(
        endpoint: string,
        payload: Record<string, unknown>,
    ): Promise<SendMessageResult> {
        if (!this.baseUrl || !this.token) {
            return { success: false, error: 'WuzAPI não configurado' };
        }
        try {
            const data = await this.post<WuzAPISendResponse>(endpoint, payload);
            return { success: true, messageId: data.data?.Id };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);

            // Retry automático: "no LID found" → resolve o número via /user/check e tenta de novo
            if (msg.includes('no LID found') && typeof payload.Phone === 'string' && !payload.Phone.endsWith('@g.us')) {
                const resolved = await this.resolvePhoneViaCheck(payload.Phone);
                if (resolved && resolved !== payload.Phone) {
                    whatsappLogger.info(`[WuzAPI] LID não encontrado para ${payload.Phone}, retentando com ${resolved}`);
                    try {
                        const data2 = await this.post<WuzAPISendResponse>(endpoint, { ...payload, Phone: resolved });
                        return { success: true, messageId: data2.data?.Id };
                    } catch (err2) {
                        const msg2 = err2 instanceof Error ? err2.message : String(err2);
                        whatsappLogger.error(`[WuzAPI] Retry também falhou:`, msg2);
                        return { success: false, error: msg2 };
                    }
                }
            }

            whatsappLogger.error(`[WuzAPI] Erro ao enviar (${endpoint}):`, msg);
            return { success: false, error: msg };
        }
    }

    /**
     * Resolve o número de telefone para o JID correto via /user/check.
     * Útil quando o WhatsApp usa o formato antigo (sem 9) para números brasileiros.
     */
    private async resolvePhoneViaCheck(phone: string): Promise<string | null> {
        try {
            const res = await this.post<{ data?: { Users?: Array<{ IsInWhatsapp: boolean; JID: string }> } }>(
                '/user/check',
                { Phone: [phone] },
            );
            const user = res?.data?.Users?.[0];
            if (user?.IsInWhatsapp && user?.JID) {
                return user.JID.replace('@s.whatsapp.net', '');
            }
        } catch {
            // Ignora erros na resolução
        }
        return null;
    }
}
