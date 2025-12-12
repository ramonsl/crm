/**
 * Repository interfaces
 * Define contracts for data access layer
 * All methods are async for PostgreSQL compatibility
 */

import type { LeadRow, TemplateRow, MessageHistoryRow, SettingRow, ActivityRow, UserRow, SessionRow } from '../types';
import type {
    CreateLeadDto,
    UpdateLeadDto,
    LeadFilters,
    CreateTemplateDto,
    UpdateTemplateDto,
    CreateMessageHistoryDto,
    MessageHistoryFilters,
    UpdateSettingDto,
    CreateActivityDto,
    ActivityFilters,
    CreateUserDto,
    UpdateUserDto,
} from './dtos';

// ============================================================================
// LEAD REPOSITORY
// ============================================================================

export interface ILeadRepository {
    /**
     * Find all leads with optional filters
     */
    findAll(filters?: LeadFilters): Promise<LeadRow[]>;

    /**
     * Find lead by ID
     */
    findById(id: number): Promise<LeadRow | null>;

    /**
     * Find lead by CPF
     */
    findByCpf(cpf: string): Promise<LeadRow | null>;

    /**
     * Find lead by phone number (tries multiple variations)
     */
    findByPhone(phone: string): Promise<LeadRow | null>;

    /**
     * Create new lead
     */
    create(lead: CreateLeadDto): Promise<LeadRow>;

    /**
     * Update a lead by CPF
     * @param cpf - CPF of the lead to update
     * @param data - Partial lead data to update
     */
    update(cpf: string, data: UpdateLeadDto): Promise<void>;

    /**
     * Delete a lead by CPF
     * @param cpf - CPF of the lead to delete
     */
    delete(cpf: string): Promise<void>;

    /**
     * Update last message info
     */
    updateLastMessage(cpf: string, message: string, time: string): Promise<void>;

    /**
     * Increment unread message count
     */
    incrementUnreadCount(cpf: string): Promise<void>;

    /**
     * Reset unread message count to 0
     */
    resetUnreadCount(cpf: string): Promise<void>;

    /**
     * Count total leads with optional filters
     */
    count(filters?: LeadFilters): Promise<number>;
}

// ============================================================================
// TEMPLATE REPOSITORY
// ============================================================================

export interface ITemplateRepository {
    /**
     * Find all templates
     */
    findAll(): Promise<TemplateRow[]>;

    /**
     * Find template by ID
     */
    findById(id: number): Promise<TemplateRow | null>;

    /**
     * Create new template
     */
    create(template: CreateTemplateDto): Promise<TemplateRow>;

    /**
     * Update existing template
     */
    update(id: number, data: UpdateTemplateDto): Promise<void>;

    /**
     * Delete template
     */
    delete(id: number): Promise<void>;
}

// ============================================================================
// MESSAGE HISTORY REPOSITORY
// ============================================================================

export interface IMessageHistoryRepository {
    /**
     * Find message history by CPF
     */
    findByCpf(cpf: string): Promise<MessageHistoryRow[]>;

    /**
     * Create message history entry
     */
    create(data: CreateMessageHistoryDto): Promise<void>;

    /**
     * Find recent messages with optional filters
     */
    findRecent(filters?: MessageHistoryFilters): Promise<MessageHistoryRow[]>;

    /**
     * Count messages by CPF
     */
    countByCpf(cpf: string): Promise<number>;
}

// ============================================================================
// SETTING REPOSITORY
// ============================================================================

export interface ISettingRepository {
    /**
     * Get setting value by key
     */
    get(key: string): Promise<string | null>;

    /**
     * Set setting value
     */
    set(key: string, value: string): Promise<void>;

    /**
     * Get multiple settings by keys
     */
    getMultiple(keys: string[]): Promise<SettingRow[]>;

    /**
     * Get all settings
     */
    getAll(): Promise<SettingRow[]>;
}

// ============================================================================
// ACTIVITY REPOSITORY - Timeline feature
// ============================================================================

export interface IActivityRepository {
    /**
     * Find activities by contact CPF
     * @param cpf - Contact CPF
     * @param limit - Optional limit (default: 50)
     */
    findByContact(cpf: string, limit?: number): Promise<ActivityRow[]>;

    /**
     * Create new activity
     */
    create(data: CreateActivityDto): Promise<ActivityRow>;

    /**
     * Find recent activities with optional filters
     */
    findRecent(filters?: ActivityFilters): Promise<ActivityRow[]>;

    /**
     * Count activities by contact CPF
     */
    countByContact(cpf: string): Promise<number>;
}

// ============================================================================
// USER REPOSITORY - Authentication
// ============================================================================

export interface IUserRepository {
    /**
     * Find all users
     */
    findAll(): Promise<UserRow[]>;

    /**
     * Find user by ID
     */
    findById(id: number): Promise<UserRow | null>;

    /**
     * Find user by email
     */
    findByEmail(email: string): Promise<UserRow | null>;

    /**
     * Create new user
     */
    create(data: CreateUserDto): Promise<UserRow>;

    /**
     * Update user
     */
    update(id: number, data: UpdateUserDto): Promise<void>;

    /**
     * Delete user
     */
    delete(id: number): Promise<void>;

    /**
     * Count total users
     */
    count(): Promise<number>;
}

// ============================================================================
// SESSION REPOSITORY - Authentication
// ============================================================================

export interface ISessionRepository {
    /**
     * Create new session
     */
    create(userId: number, expiresAt: string): Promise<SessionRow>;

    /**
     * Find session by ID
     */
    findById(sessionId: string): Promise<SessionRow | null>;

    /**
     * Find sessions by user ID
     */
    findByUserId(userId: number): Promise<SessionRow[]>;

    /**
     * Delete session
     */
    delete(sessionId: string): Promise<void>;

    /**
     * Delete all sessions for a user
     */
    deleteByUserId(userId: number): Promise<void>;

    /**
     * Delete expired sessions
     */
    deleteExpired(): Promise<void>;
}
