/**
 * Data Transfer Objects (DTOs) for repository layer
 * These define the shape of data being transferred between layers
 */

// ============================================================================
// LEAD DTOs
// ============================================================================

export interface CreateLeadDto {
    cpf: string;
    nome: string;
    telefone: string;
    email?: string;
    status: string;
    data_inscricao?: string;
    notes?: string;
    curso_interesse?: string;
    escola?: string;
    tipo_ingresso?: string;
}

export interface UpdateLeadDto {
    nome?: string;
    telefone?: string;
    email?: string;
    status?: string;
    notes?: string;
    curso_interesse?: string;
    escola?: string;
    tipo_ingresso?: string;
    last_message?: string;
    last_message_time?: string;
    unread_count?: number;
    profile_image?: string;
    last_template_name?: string;

    // Import/System fields
    is_new?: number;
    status_changed?: number;
    status_changed_at?: string;
    data_inscricao?: string | null;
    last_import_date?: boolean;
}

export interface LeadFilters {
    status?: string;
    curso?: string;
    escola?: string;
    search?: string;
    hasUnread?: boolean;
    page?: number;
    pageSize?: number;
}

// ============================================================================
// TEMPLATE DTOs
// ============================================================================

export interface CreateTemplateDto {
    name: string;
    message: string;
    type: 'fixed' | 'ai';
}

export interface UpdateTemplateDto {
    name?: string;
    message?: string;
    type?: 'fixed' | 'ai';
}

// ============================================================================
// MESSAGE HISTORY DTOs
// ============================================================================

export interface CreateMessageHistoryDto {
    contact_cpf: string;
    template_id?: number;
    template_name: string;
    message_content: string;
    status: 'sent' | 'failed';
}

export interface MessageHistoryFilters {
    cpf?: string;
    status?: 'sent' | 'failed';
    limit?: number;
    offset?: number;
}

// ============================================================================
// SETTING DTOs
// ============================================================================

export interface UpdateSettingDto {
    key: string;
    value: string;
}

// ============================================================================
// ACTIVITY DTOs - Timeline feature
// ============================================================================

export type ActivityType = 'whatsapp' | 'status_change' | 'note' | 'lead_created' | 'lead_updated' | 'forwarded';
export type ActivitySubtype = 'sent' | 'received' | 'template' | null;

export interface CreateActivityDto {
    contact_cpf: string;
    type: ActivityType;
    subtype?: ActivitySubtype;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
}

export interface ActivityFilters {
    cpf?: string;
    type?: ActivityType;
    limit?: number;
    offset?: number;
}

// ============================================================================
// USER DTOs - Authentication
// ============================================================================

export interface CreateUserDto {
    email: string;
    password_hash: string;
    name: string;
    role?: string;
}

export interface UpdateUserDto {
    email?: string;
    password_hash?: string;
    name?: string;
    role?: string;
    active?: number;
}

export interface CreateMessageDto {
    id: string;
    contact_phone: string;
    content: string;
    from_me: boolean;
    type: string;
    media_url?: string;
    media_type?: string;
    timestamp?: Date;
}

export interface ChatFilters {
    limit?: number;
    offset?: number;
}

