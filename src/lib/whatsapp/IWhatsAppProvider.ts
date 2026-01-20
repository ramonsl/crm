/**
 * WhatsApp Provider Interface
 * 
 * Define contrato para todos os providers de WhatsApp.
 * Qualquer provider (Baileys, wwebjs, Twilio, etc) deve implementar esta interface.
 * 
 * @example
 * ```typescript
 * import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory';
 * 
 * const provider = await WhatsAppProviderFactory.getProvider();
 * await provider.sendTextMessage('5511999999999', 'Olá!');
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export type WhatsAppStatus = 'connecting' | 'ready' | 'qr' | 'disconnected';

export type MediaType = 'image' | 'video' | 'audio' | 'document';

export interface WhatsAppMessage {
    from: string;              // Telefone do remetente (normalizado, sem sufixos)
    body: string;              // Conteúdo da mensagem
    isGroup: boolean;          // Se é mensagem de grupo
    timestamp: Date;           // Data/hora da mensagem
    fromMe: boolean;           // Se foi enviada por mim
    id: string;                // ID único da mensagem
    mediaUrl?: string;         // URL da mídia (se houver)
    mediaType?: MediaType;     // Tipo de mídia
}

export interface WhatsAppStatusResponse {
    status: WhatsAppStatus;
    qrCode?: string;           // QR Code em base64 (se status = 'qr')
    phoneNumber?: string;      // Número conectado (se status = 'ready')
}

export interface SendMessageResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export interface ContactInfo {
    name?: string;             // Nome do contato
    pushname?: string;         // Nome exibido no WhatsApp
    profilePicture?: string;   // URL da foto de perfil
}

export type MessageCallback = (message: WhatsAppMessage) => void;
export type StatusCallback = (status: WhatsAppStatusResponse) => void;

// ============================================================================
// INTERFACE
// ============================================================================

export interface IWhatsAppProvider {

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    /**
     * Inicializa o provider e estabelece conexão
     * @throws Error se falhar ao inicializar
     */
    initialize(): Promise<void>;

    /**
     * Reinicia a conexão mantendo sessão
     */
    restart(): Promise<void>;

    /**
     * Desconecta e faz logout (remove sessão)
     */
    logout(): Promise<void>;

    /**
     * Limpa sessão e reconecta (se autoReconnect = true)
     * @param autoReconnect Se deve reconectar após limpar
     */
    clearSession(autoReconnect?: boolean): Promise<void>;

    // ========================================================================
    // STATUS & CONNECTION
    // ========================================================================

    /**
     * Retorna status atual da conexão
     */
    getStatus(): Promise<WhatsAppStatusResponse>;

    /**
     * Verifica se está pronto para enviar mensagens
     */
    isReady(): Promise<boolean>;

    // ========================================================================
    // MESSAGING - TEXTO
    // ========================================================================

    /**
     * Envia mensagem de texto
     * @param phone Telefone do destinatário (com código país)
     * @param message Texto da mensagem
     * @returns Resultado do envio
     */
    sendTextMessage(phone: string, message: string): Promise<SendMessageResult>;

    // ========================================================================
    // MESSAGING - MÍDIA
    // ========================================================================

    /**
     * Envia imagem
     * @param phone Telefone do destinatário
     * @param imageUrl URL da imagem (local ou remota)
     * @param caption Legenda opcional
     */
    sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResult>;

    /**
     * Envia vídeo
     * @param phone Telefone do destinatário
     * @param videoUrl URL do vídeo
     * @param caption Legenda opcional
     */
    sendVideo(phone: string, videoUrl: string, caption?: string): Promise<SendMessageResult>;

    /**
     * Envia áudio
     * @param phone Telefone do destinatário
     * @param audioUrl URL do áudio
     * @param ptt Se é áudio de voz (Push-to-Talk)
     */
    sendAudio(phone: string, audioUrl: string, ptt?: boolean): Promise<SendMessageResult>;

    /**
     * Envia documento
     * @param phone Telefone do destinatário
     * @param documentUrl URL do documento
     * @param filename Nome do arquivo
     */
    sendDocument(phone: string, documentUrl: string, filename?: string): Promise<SendMessageResult>;

    /**
     * Envia mensagem genérica (detecta tipo automaticamente)
     * @param phone Telefone do destinatário
     * @param message Texto da mensagem
     * @param mediaUrl URL da mídia (opcional)
     * @param mediaType Tipo de mídia (opcional, detecta automaticamente se não informado)
     */
    sendMessage(
        phone: string,
        message: string,
        mediaUrl?: string,
        mediaType?: MediaType
    ): Promise<SendMessageResult>;

    // ========================================================================
    // CONTACTS & PROFILE
    // ========================================================================

    /**
     * Busca foto de perfil do contato
     * @param phone Telefone do contato
     * @returns URL da foto ou null se não encontrada
     */
    getProfilePicture(phone: string): Promise<string | null>;

    /**
     * Valida se número existe no WhatsApp
     * @param phone Telefone para validar
     * @returns Número formatado se válido, null se inválido
     */
    validateNumber(phone: string): Promise<string | null>;

    /**
     * Busca informações do contato
     * @param phone Telefone do contato
     * @returns Informações do contato ou null
     */
    getContactInfo(phone: string): Promise<ContactInfo | null>;

    // ========================================================================
    // EVENTS
    // ========================================================================

    /**
     * Registra callback para mensagens recebidas
     * @param callback Função chamada quando mensagem chega
     */
    onMessage(callback: MessageCallback): void;

    /**
     * Registra callback para mudanças de status
     * @param callback Função chamada quando status muda
     */
    onStatusChange(callback: StatusCallback): void;

    /**
     * Remove callback de mensagens
     */
    offMessage(): void;

    /**
     * Remove callback de status
     */
    offStatusChange(): void;

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Retorna nome do provider
     */
    getProviderName(): string;

    /**
     * Retorna versão do provider
     */
    getProviderVersion(): string;
}
