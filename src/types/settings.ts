export interface StatusItem {
    id: number;
    name: string;
    color: string;
    display_order: number;
}

export interface DuplicateGroup {
    telefone: string;
    registros: Array<{
        cpf: string;
        nome: string;
        email: string | null;
        status: string;
        tipo_ingresso: string | null;
        created_at: string;
        updated_at: string;
    }>;
}

export interface SettingsData {
    openaiApiKey?: string;
    minDelay?: number;
    maxDelay?: number;
    metaMatriculas?: number;
    comercialPhone?: string;
    comercialName?: string;
}

export interface SyncResults {
    success?: boolean;
    updated?: number;
    failed?: number;
    message?: string;
}
