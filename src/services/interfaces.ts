/**
 * Service Interfaces
 * 
 * Contracts for the service layer following DIP (Dependency Inversion Principle).
 * All services should implement these interfaces to allow for:
 * - Easy testing with mocks
 * - Swapping implementations
 * - Clear contracts for dependencies
 */

import type { UserRow, ActivityRow } from '@/lib/types';
import type { AutoReply } from '@/types/autoReply';

// ============================================================================
// AUTH SERVICE
// ============================================================================

export interface RegisterResult {
    success: boolean;
    user?: Omit<UserRow, 'password_hash'>;
    error?: string;
}

export interface LoginResult {
    success: boolean;
    sessionId?: string;
    user?: Omit<UserRow, 'password_hash'>;
    error?: string;
}

export interface SessionValidationResult {
    valid: boolean;
    user?: Omit<UserRow, 'password_hash'>;
    error?: string;
}

export interface IAuthService {
    register(email: string, password: string, name: string): Promise<RegisterResult>;
    login(email: string, password: string): Promise<LoginResult>;
    logout(sessionId: string): Promise<void>;
    validateSession(sessionId: string): Promise<SessionValidationResult>;
    getUserFromSession(sessionId: string): Promise<Omit<UserRow, 'password_hash'> | null>;
    cleanupExpiredSessions(): Promise<void>;
}

// ============================================================================
// ACTIVITY SERVICE
// ============================================================================

export interface IActivityService {
    logWhatsAppSent(cpf: string, message: string, templateName?: string): Promise<ActivityRow>;
    logWhatsAppReceived(cpf: string, message: string): Promise<ActivityRow>;
    logStatusChange(cpf: string, fromStatus: string, toStatus: string): Promise<ActivityRow>;
    logNote(cpf: string, note: string): Promise<ActivityRow>;
    logLeadCreated(cpf: string, nome: string, source?: string): Promise<ActivityRow>;
    logLeadUpdated(cpf: string, changes: Record<string, unknown>): Promise<ActivityRow>;
    logForwarded(cpf: string, comercialName: string): Promise<ActivityRow>;
}

// ============================================================================
// AUTO-REPLY SERVICE
// ============================================================================

export interface AutoReplyConfig {
    isEnabled: boolean;
    rateLimitMinutes: number;
    blacklistedCount: number;
}

export interface IAutoReplyService {
    processIncomingMessage(phone: string, message: string): Promise<string | null>;
    renderTemplate(template: string, context: { phone: string; message: string; name?: string }): string;
    setEnabled(enabled: boolean): void;
    isAutoReplyEnabled(): boolean;
    addToBlacklist(phone: string): void;
    removeFromBlacklist(phone: string): void;
    isBlacklisted(phone: string): boolean;
    setRateLimitMinutes(minutes: number): void;
    getConfig(): AutoReplyConfig;
}

// ============================================================================
// INTENT DETECTION SERVICE
// ============================================================================

export interface IntentDetectionResult {
    intent: string;
    confidence: number;
    autoReplyId: number;
}

export interface IIntentDetectionService {
    detectIntent(message: string, autoReplies: AutoReply[]): Promise<IntentDetectionResult | null>;
}

// ============================================================================
// CONTACT SYNC SERVICE
// ============================================================================

export interface ContactSyncResult {
    created: number;
    updated: number;
    errors: number;
}

export interface IContactSyncService {
    syncFromWhatsApp(): Promise<ContactSyncResult>;
}

// ============================================================================
// TEMPLATE HISTORY SERVICE
// ============================================================================

export interface TemplateHistoryEntry {
    id: number;
    contact_cpf: string;
    template_id: number | null;
    template_name: string;
    message_content: string;
    status: string;
    created_at: string;
}

export interface ITemplateHistoryService {
    getHistoryByCpf(cpf: string): Promise<TemplateHistoryEntry[]>;
    getRecentHistory(limit?: number): Promise<TemplateHistoryEntry[]>;
    recordSent(cpf: string, templateId: number | null, templateName: string, messageContent: string): Promise<void>;
    recordFailed(cpf: string, templateId: number | null, templateName: string, messageContent: string): Promise<void>;
}

// ============================================================================
// WHATSAPP CHAT SERVICE
// ============================================================================

export interface ChatInfo {
    id: string;
    name: string;
    leadName: string | null;
    cpf: string | null;
    profilePicUrl: string | null;
    lastMessage: string | null;
    lastMessageTime: number | null;
    unreadCount: number;
    isGroup: boolean;
    phone: string | null;
    status: string | null;
    isRegistered: boolean;
}

export interface ChatMessage {
    id: string;
    body: string;
    fromMe: boolean;
    timestamp: number;
    hasMedia: boolean;
    mediaUrl: string | null;
    mediaType: 'image' | 'video' | 'audio' | 'document' | null;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    ack: number;
}

export interface IWhatsAppChatService {
    isReady(): boolean;
    getAllChats(includeGroups?: boolean): Promise<ChatInfo[]>;
    getChatMessages(chatId: string, limit?: number): Promise<ChatMessage[]>;
    markAsRead(chatId: string): Promise<void>;
}

// ============================================================================
// TAG SERVICE (Function-based, exports interface for consistency)
// ============================================================================

export interface Tag {
    id: number;
    name: string;
    color: string;
}

export interface TagOperationResult {
    success: boolean;
    tagId?: number;
    error?: string;
}

export interface ITagService {
    findTagByName(tagName: string): Promise<Tag | null>;
    createTag(name: string, color?: string): Promise<Tag | null>;
    associateTagWithLead(cpf: string, tagId: number): Promise<boolean>;
    addTagToLead(cpf: string, tagName: string, tagColor?: string): Promise<TagOperationResult>;
}

// ============================================================================
// WHATSAPP VALIDATOR SERVICE
// ============================================================================

export interface WhatsAppValidationResult {
    isValid: boolean;
    isRegistered: boolean;
    normalizedPhone?: string;
}

export interface IWhatsAppValidatorService {
    validateNumber(phone: string): Promise<WhatsAppValidationResult>;
    isValidFormat(phone: string): boolean;
    normalizePhone(phone: string): string;
}
