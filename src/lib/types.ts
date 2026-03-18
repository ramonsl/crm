/**
 * Centralized type definitions for the CRM application
 * Eliminates use of 'any' and provides type safety
 */

import type { Pool, PoolClient } from 'pg';

// ============================================================================
// DATABASE TYPES
// ============================================================================

/**
 * Neon PostgreSQL Pool instance type
 */
export type DatabaseInstance = Pool;

/**
 * Neon PostgreSQL Client type (for transactions)
 */
export type DatabaseClient = PoolClient;

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
    status_changed_at: string | null;
    last_import_date: string | null;
    last_template_name: string | null;
    tipo_ingresso?: string | null;
    whatsapp_valido?: number;
    profile_picture?: string | null;
    last_template_sent?: string | null;
    last_template_sent_at?: string | null;
    created_at?: string;
    updated_at?: string;
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
    id: string;
    contact_phone: string;
    content: string | null;
    timestamp: string;
    from_me: boolean;
    type: string;
    media_url: string | null;
    read: boolean;
}

/**
 * Template table row
 */
export interface TemplateRow {
    id: number;
    name: string;
    message: string;
    type: 'fixed' | 'ai';
    created_at?: string;
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

/**
 * User table row - Authentication
 */
export interface UserRow {
    id: number;
    email: string;
    password_hash: string;
    name: string;
    role: string;
    active: number;
    created_at: string;
    updated_at: string;
}

/**
 * Session table row - Authentication
 */
export interface SessionRow {
    id: string;
    user_id: number;
    expires_at: string;
    created_at: string;
}

/**
 * Status table row
 */
export interface StatusRow {
    id: number;
    name: string;
    color: string;
    display_order: number;
    active: number;
    created_at: string;
    updated_at: string;
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

/**
 * WhatsApp Web Chat object (from whatsapp-web.js getChats())
 * This is the actual type returned by client.getChats()
 */
export interface WhatsAppWebChat {
    id: {
        _serialized: string;
        user?: string;
    };
    name: string;
    isGroup: boolean;
    unreadCount: number;
    timestamp?: number;
    archived?: boolean;

    // Methods available on Chat object
    fetchMessages(options: { limit: number }): Promise<WhatsAppWebMessage[]>;
    sendMessage(content: string): Promise<WhatsAppWebMessage>;
    sendSeen(): Promise<boolean>; // Returns boolean, not void
}

/**
 * WhatsApp Web Message object (from whatsapp-web.js)
 * This is the actual type returned by chat.fetchMessages()
 */
export interface WhatsAppWebMessage {
    id: {
        id: string;
        _serialized: string;
    };
    body: string;
    fromMe: boolean;
    timestamp: number;
    hasMedia: boolean;
    ack?: number; // -1: failed, 1: sent, 2: delivered, 3+: read
    from: string;
    to: string;
    type?: string;
    author?: string;
}


// ============================================================================
// LINKEDIN JOB TYPES
// ============================================================================

/**
 * Seniority level for job classification
 */
export type SeniorityLevel = 'estagio' | 'junior' | 'pleno' | 'senior' | 'outros';

/**
 * LinkedIn Job status
 */
export type LinkedInJobStatus = 'pending' | 'collected' | 'posted' | 'rejected' | 'error';

/**
 * LinkedIn Job table row
 */
export interface LinkedInJobRow {
    id: number;
    linkedin_post_id: string;
    title: string;
    company: string;
    location: string | null;
    is_remote: boolean;
    raw_content: string | null;
    formatted_message: string | null;
    url: string | null;
    posted_at: string | null;
    created_at: string;
    status: LinkedInJobStatus;
    error_message: string | null;
    seniority_level: SeniorityLevel;
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
export function safeGetErrorMessage(error: unknown): string {
    if (isStandardError(error)) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error';
}

// Alias for backward compatibility
export { safeGetErrorMessage as getErrorMessage };
