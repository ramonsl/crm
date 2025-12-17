/**
 * Shared types for Contacts/Leads management
 */

export interface Contact {
    id?: number;
    cpf: string;
    nome: string;
    telefone: string;
    email?: string;
    status: string;
    tipo_ingresso?: string;
    curso_interesse?: string;
    escola?: string;
    created_at?: string;
    updated_at?: string;
    unread_count?: number;
    last_message?: string | null;
    last_message_time?: string | null;
    whatsapp_valido?: number | null;
    profile_picture?: string | null;
    profile_image?: string | null;
    last_template_sent?: string | null; // Nome do último template enviado
    last_template_sent_at?: string | null; // Data de envio do último template
    is_new?: number;
    status_changed?: number;
    status_changed_at?: string;
    last_import_date?: string;
    last_template_name?: string;
}

export type ContactStatus =
    | 'NOVO'
    | 'LEAD'
    | 'EM_CONTATO'
    | 'APROVADO'
    | 'MATRICULADO'
    | 'DESISTENTE'
    | 'REPROVADO';

export type ContactView = 'all' | 'leads' | 'inscritos' | 'outros';

export interface ContactsFilters {
    search?: string;
    status?: string[];
    semester?: string[];
    course?: string[];
    lastMessagePeriod?: string;
    showOnlyNew?: boolean;
    showOnlyStatusChanged?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface ContactsState {
    contacts: Contact[];
    loading: boolean;
    error: string | null;
    totalPages: number;
    currentPage: number;
}

export const VIEW_FILTERS: Record<ContactView, Partial<ContactsFilters>> = {
    all: {},
    leads: {
        status: ['NOVO', 'LEAD']
    },
    inscritos: {
        status: [
            'INSCRITO',
            'Inscrito Confirmado',
            'Aprovado',
            'Reprovado',
            'Pagamento da Matrícula Iniciado',
            'Matricula Confirmada',
            'Desistente'
        ]
    },
    outros: {}  // Filtro especial - tratado no hook com lógica de exclusão
};

export const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    // Leads
    'NOVO': { color: 'blue', label: 'Novo Lead' },
    'LEAD': { color: 'purple', label: 'Lead' },
    'EM_CONTATO': { color: 'yellow', label: 'Em Contato' },

    // Inscritos
    'INSCRITO': { color: 'cyan', label: 'Inscrito' },
    'Inscrito Confirmado': { color: 'cyan', label: 'Inscrito Confirmado' },

    // Aprovação
    'Aprovado': { color: 'light-orange', label: 'Aprovado' },
    'APROVADO': { color: 'light-orange', label: 'Aprovado' },
    'Reprovado': { color: 'red', label: 'Reprovado' },
    'REPROVADO': { color: 'red', label: 'Reprovado' },

    // Matrícula
    'Pagamento da Matrícula Iniciado': { color: 'orange', label: 'Pagamento Iniciado' },
    'Matricula Confirmada': { color: 'green', label: 'Matrícula Confirmada' },
    'MATRICULADO': { color: 'green', label: 'Matriculado' },

    // Desistência
    'Desistente': { color: 'gray', label: 'Desistente' },
    'DESISTENTE': { color: 'gray', label: 'Desistente' },
};
