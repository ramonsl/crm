/**
 * Status Types
 * 
 * Types for lead/contact status management.
 */

export interface Status {
    id: number;
    name: string;
    color: string;
    sort_order: number;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}
