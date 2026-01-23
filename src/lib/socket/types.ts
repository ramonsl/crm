/**
 * Socket.io Event Types
 * 
 * Define interfaces for type-safe Socket.io communication following
 * Interface Segregation Principle (SOLID)
 */

/**
 * Events emitted from Server to Client
 */
export interface ServerToClientEvents {
    /**
     * Emitted when a new message is received from WhatsApp
     */
    'message:new': (data: NewMessageEvent) => void;

    /**
     * Emitted when a message is successfully sent
     */
    'message:sent': (data: SentMessageEvent) => void;

    /**
     * Emitted when a contact's data is updated
     */
    'contact:updated': (data: ContactUpdatedEvent) => void;

    /**
     * Emitted when WhatsApp connection status changes
     */
    'whatsapp:status': (data: WhatsAppStatusEvent) => void;

    /**
     * General connection confirmation
     */
    'connected': () => void;

    /**
     * Emitted when queue state changes (logs, stats, items)
     */
    'queue:update': (data: any) => void;

    /**
     * Emitted when WhatsApp history synchronization is in progress
     */
    'whatsapp:history': (data: WhatsAppHistoryEvent) => void;
}

/**
 * Events emitted from Client to Server
 */
export interface ClientToServerEvents {
    /**
     * Client sends a message
     */
    'message:send': (data: SendMessagePayload, callback: (response: SendMessageResponse) => void) => void;

    /**
     * Client requests to join a contact's room for real-time updates
     */
    'room:join': (contactCpf: string) => void;

    /**
     * Client leaves a contact's room
     */
    'room:leave': (contactCpf: string) => void;

    /**
     * Client requests to join a phone room for WhatsApp chat updates
     */
    'room:join:phone': (phone: string) => void;

    /**
     * Client leaves a phone room
     */
    'room:leave:phone': (phone: string) => void;
}

/**
 * Data attached to each socket connection
 */
export interface SocketData {
    userId?: number;
    username?: string;
    sessionId?: string;
    userRole?: string;
}

// Message events
export interface NewMessageEvent {
    contactCpf: string;
    contactName?: string; // Optional contact name for notifications
    message: {
        id: number;
        message_id: string;
        direction: 'incoming' | 'outgoing';
        body: string;
        media_url: string | null;
        media_type: string | null;
        timestamp: string;
        status: string;
    };
}

export interface SentMessageEvent {
    contactCpf: string;
    message: {
        id: number;
        direction: 'outgoing';
        body: string;
        timestamp: string;
        status: string;
        media_url?: string | null;
        media_type?: 'image' | 'video' | 'audio' | 'document';
    };
}

export interface ContactUpdatedEvent {
    cpf: string;
    updates: {
        last_message?: string;
        last_message_time?: string;
        last_message_direction?: 'incoming' | 'outgoing';
        unread_count?: number;
        profile_image?: string | null;
    };
}

export interface WhatsAppStatusEvent {
    status: 'connecting' | 'ready' | 'qr' | 'disconnected';
    qr?: string;
    phoneNumber?: string;
}

export interface SendMessagePayload {
    telefone: string;
    message: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'audio' | 'document';
}

export interface SendMessageResponse {
    success: boolean;
    error?: string;
    messageId?: number;
}

export interface WhatsAppHistoryEvent {
    progress: number;
    total?: number;
    status: string;
}
