/**
 * Centralized type definitions for the CRM application
 * Eliminates use of 'any' and provides type safety
 */

import type { Database } from 'better-sqlite3';

// ============================================================================
// DATABASE TYPES
// ============================================================================

/**
 * Better-sqlite3 Database instance type
 */
export type DatabaseInstance = Database;

/**
 * Settings table row
 */
export interface SettingRow {
    key: string;
    value: string;
}

/**
 * Lead/Contact table row
 */
export interface LeadRow {
    id: number;
    cpf: string;
    nome: string;
    telefone: string;
    email: string | null;
    status: string;
    last_message: string | null;
    last_message_time: string | null;
    unread_count: number;
    data_inscricao: string | null;
    notes: string | null;
    profile_image: string | null;
    curso_interesse: string | null;
    escola: string | null;
    is_new: number;
    status_changed: number;
    last_import_date: string | null;
    last_template_name: string | null;
}

/**
 * Message history table row
 */
export interface MessageHistoryRow {
    id: number;
    contact_cpf: string;
    template_id: number | null;
    template_name: string;
    message_content: string;
    sent_at: string;
    status: 'sent' | 'failed';
}

/**
 * Message table row
 */
export interface MessageRow {
    id: number;
    contact_cpf: string;
    message_id: string;
    direction: 'incoming' | 'outgoing';
    body: string;
    timestamp: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    media_url: string | null;
    media_type: 'image' | 'audio' | 'video' | 'document' | null;
}

/**
 * Template table row
 */
export interface TemplateRow {
    id: number;
    name: string;
    message: string;
    type: 'fixed' | 'ai';
}

/**
 * Activity table row - Timeline feature
 */
export interface ActivityRow {
    id: number;
    contact_cpf: string;
    type: 'whatsapp' | 'status_change' | 'note' | 'lead_created' | 'lead_updated';
    subtype: 'sent' | 'received' | 'template' | null;
    title: string;
    description: string | null;
    metadata: string | null;
    created_at: string;
}

// ============================================================================
// WHATSAPP TYPES
// ============================================================================

/**
 * WhatsApp message object from whatsapp-web.js
 */
export interface WhatsAppMessage {
    id: {
        fromMe: boolean;
        remote: string;
        id: string;
        _serialized: string;
    };
    ack?: number;
    hasMedia: boolean;
    body: string;
    type: string;
    timestamp: number;
    from: string;
    to?: string;
    fromMe: boolean;
    author?: string;
    isForwarded?: boolean;
    broadcast?: boolean;
    isStatus?: boolean;
    isStarred?: boolean;
    isGif?: boolean;

    // Methods
    getContact(): Promise<WhatsAppContact>;
    getChat(): Promise<WhatsAppChat>;
    downloadMedia?(): Promise<WhatsAppMedia | undefined>;
    reply?(content: string): Promise<WhatsAppMessage>;
}

/**
 * WhatsApp contact object
 */
export interface WhatsAppContact {
    id: {
        server: string;
        user: string;
        _serialized: string;
    };
    number: string;
    pushname?: string;
    name?: string;
    isMe: boolean;
    isUser: boolean;
    isGroup: boolean;
    isWAContact: boolean;
    isMyContact: boolean;
}

/**
 * WhatsApp chat object
 */
export interface WhatsAppChat {
    id: {
        server: string;
        user: string;
        _serialized: string;
    };
    name: string;
    isGroup: boolean;
    isReadOnly: boolean;
    unreadCount: number;
    timestamp: number;
    archived: boolean;

    // Methods
    fetchMessages(options: { limit: number }): Promise<WhatsAppMessage[]>;
    sendMessage(content: string): Promise<WhatsAppMessage>;
}

/**
 * WhatsApp media object
 */
export interface WhatsAppMedia {
    mimetype: string;
    data: string; // base64
    filename?: string;
    filesize?: number;
}

/**
 * WhatsApp registered user from getNumberId
 */
export interface WhatsAppRegisteredUser {
    _serialized: string;
    user: string;
    server: string;
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * OpenAI API response
 */
export interface OpenAIResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    error?: {
        message: string;
        type: string;
        code?: string;
    };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Standard error with message
 */
export interface StandardError {
    message: string;
    stack?: string;
    code?: string;
    name?: string;
}

/**
 * Type guard for StandardError
 */
export function isStandardError(error: unknown): error is StandardError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as StandardError).message === 'string'
    );
}

/**
 * Safely extract error message
 */
export function getErrorMessage(error: unknown): string {
    if (isStandardError(error)) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error';
}
