/**
 * Repository interfaces
 * Define contracts for data access layer
 */

import type { LeadRow, TemplateRow, MessageHistoryRow, SettingRow, ActivityRow } from '../types';
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
} from './dtos';

// ============================================================================
// LEAD REPOSITORY
// ============================================================================

export interface ILeadRepository {
    /**
     * Find all leads with optional filters
     */
    findAll(filters?: LeadFilters): LeadRow[];

    /**
     * Find lead by ID
     */
    findById(id: number): LeadRow | null;

    /**
     * Find lead by CPF
     */
    findByCpf(cpf: string): LeadRow | null;

    /**
     * Find lead by phone number (tries multiple variations)
     */
    findByPhone(phone: string): LeadRow | null;

    /**
     * Create new lead
     */
    create(lead: CreateLeadDto): LeadRow;

    /**
     * Update a lead by CPF
     * @param cpf - CPF of the lead to update
     * @param data - Partial lead data to update
     */
    update(cpf: string, data: UpdateLeadDto): void;

    /**
     * Delete a lead by CPF
     * @param cpf - CPF of the lead to delete
     */
    delete(cpf: string): void;

    /**
     * Update last message info
     */
    updateLastMessage(cpf: string, message: string, time: string): void;

    /**
     * Increment unread message count
     */
    incrementUnreadCount(cpf: string): void;

    /**
     * Reset unread message count to 0
     */
    resetUnreadCount(cpf: string): void;

    /**
     * Count total leads with optional filters
     */
    count(filters?: LeadFilters): number;
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
    findByContact(cpf: string, limit?: number): ActivityRow[];

    /**
     * Create new activity
     */
    create(data: CreateActivityDto): ActivityRow;

    /**
     * Find recent activities with optional filters
     */
    findRecent(filters?: ActivityFilters): ActivityRow[];

    /**
     * Count activities by contact CPF
     */
    countByContact(cpf: string): number;
}
