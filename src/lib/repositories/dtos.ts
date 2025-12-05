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
