/**
 * YCloud Webhook Types
 * 
 * Type definitions for YCloud webhook events:
 * - Inbound messages received from users
 * - Message status updates (sent, delivered, read, failed)
 */

// ============ Webhook Event Types ============

/**
 * Base webhook event structure from YCloud
 */
export interface YCloudWebhookEvent {
    id: string;
    type: YCloudEventType;
    apiVersion: string;
    createTime: string;

    // One of these will be present based on event type
    whatsappInboundMessage?: YCloudInboundMessage;
    whatsappMessage?: YCloudMessageStatus;
}

/**
 * Supported YCloud event types
 */
export type YCloudEventType =
    | 'whatsapp.inbound_message.received'
    | 'whatsapp.message.updated';

// ============ Inbound Message Types ============

/**
 * Inbound message received from a WhatsApp user
 */
export interface YCloudInboundMessage {
    id: string;
    wabaId: string;
    from: string;               // Sender phone number
    customerProfile?: {
        name?: string;
    };
    to: string;                 // Business phone number
    sendTime: string;           // ISO timestamp
    type: YCloudMessageType;

    // Content based on type
    text?: {
        body: string;
    };
    image?: YCloudMediaContent;
    video?: YCloudMediaContent;
    audio?: YCloudMediaContent;
    document?: YCloudMediaContent & {
        filename?: string;
    };
    location?: {
        latitude: number;
        longitude: number;
        name?: string;
        address?: string;
    };
    contacts?: Array<{
        name: {
            formatted_name: string;
        };
        phones?: Array<{
            phone: string;
            type: string;
        }>;
    }>;
    button?: {
        text: string;
        payload: string;
    };
    interactive?: {
        type: string;
        button_reply?: {
            id: string;
            title: string;
        };
        list_reply?: {
            id: string;
            title: string;
            description?: string;
        };
    };
}

export type YCloudMessageType =
    | 'text'
    | 'image'
    | 'video'
    | 'audio'
    | 'document'
    | 'location'
    | 'contacts'
    | 'button'
    | 'interactive';

export interface YCloudMediaContent {
    id: string;
    link?: string;
    caption?: string;
    mimeType?: string;
    sha256?: string;
}

// ============ Message Status Types ============

/**
 * Status update for an outbound message
 */
export interface YCloudMessageStatus {
    id: string;
    wabaId: string;
    from: string;               // Business phone number
    to: string;                 // Recipient phone number
    sendTime: string;
    status: YCloudDeliveryStatus;
    error?: {
        code: number;
        message: string;
    };
}

export type YCloudDeliveryStatus =
    | 'accepted'
    | 'sent'
    | 'delivered'
    | 'read'
    | 'failed';
