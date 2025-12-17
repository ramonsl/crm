/**
 * Import/Upload Type Definitions
 * 
 * Types for CSV/Excel import functionality
 */

/**
 * Dynamic row from Excel/CSV parsing
 * Keys are column headers, values can be any primitive type
 */
export interface UploadRow {
    [key: string]: string | number | null | undefined;
}

/**
 * Parsed and validated lead data from import
 */
export interface ParsedLeadData {
    cpf: string;
    nome: string;
    email: string;
    telefone: string;
    status: string;
    tipo_ingresso: string;
    data_inscricao: string | null;
}

/**
 * Import result summary
 */
export interface ImportResult {
    created: number;
    updated: number;
    errors: number;
    total: number;
}
