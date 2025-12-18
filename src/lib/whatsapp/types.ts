/**
 * WhatsApp Module - Shared Types
 * 
 * Interfaces and types used across all WhatsApp service modules.
 * Following Single Responsibility Principle (SRP) for type definitions.
 */

import { Client, MessageMedia } from 'whatsapp-web.js';

// ============================================================================
// CLIENT STATE TYPES
// ============================================================================

export type WhatsAppStatus = 'disconnected' | 'initializing' | 'ready';

export interface WhatsAppClientState {
    client: Client | null;
    status: WhatsAppStatus;
    qrCode: string | null;
    phoneNumber: string | null;
    reconnectAttempts: number;
    reconnectTimer: NodeJS.Timeout | null;
    lastDisconnect: number | null;
    healthCheckTimer: NodeJS.Timeout | null;
    restartHistory: number[];
}

export interface WhatsAppStatusResponse {
    status: WhatsAppStatus;
    qrCode: string | null;
    phoneNumber: string | null;
}

// ============================================================================
// MESSAGING TYPES
// ============================================================================

export interface SendMessageOptions {
    mediaUrl?: string;
    mediaType?: string;
}

export interface SendMessageResult {
    success: boolean;
    id?: string;
    error?: string;
}

export type MessageContent = string | MessageMedia;

// ============================================================================
// GROUP TYPES
// ============================================================================

export interface GroupInfo {
    id: string;
    name: string;
    participantCount: number;
}

export interface GroupParticipant {
    phone: string;
    isAdmin: boolean;
    name?: string;
}

// ============================================================================
// MESSAGE EVENT TYPES
// ============================================================================

export type MessageDirection = 'incoming' | 'outgoing';

export interface ProcessedMessage {
    id: number;
    messageId: string;
    direction: MessageDirection;
    body: string;
    mediaUrl: string | null;
    mediaType: 'image' | 'audio' | 'video' | 'document' | null;
    timestamp: string;
    status: string;
}

export interface ContactInfo {
    cpf: string;
    nome: string;
    telefone: string;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
    isValid: boolean;
    normalizedId: string | null;
}

// ============================================================================
// EXTENDED WHATSAPP-WEB.JS TYPES
// ============================================================================

/**
 * Extended Chat type to include group-specific properties
 * that are not in the base whatsapp-web.js types
 */
export interface GroupChat {
    id: { user: string; _serialized: string };
    name: string;
    isGroup: boolean;
    participants?: Array<{
        id: { user: string; _serialized: string };
        isAdmin?: boolean;
    }>;
}
