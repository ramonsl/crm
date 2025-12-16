/**
 * Tag Type Definitions
 * 
 * Types for the tags system allowing categorization of leads.
 */

export interface Tag {
    id: number;
    name: string;
    color: string;
    description?: string;
    created_at: string;
    updated_at: string;
    active: number;
}

export interface LeadTag {
    id: number;
    lead_cpf: string;
    tag_id: number;
    created_at: string;
}

// Extended Tag with usage count (for management view)
export interface TagWithUsage extends Tag {
    usage_count: number;
}

// DTO for creating a tag
export interface CreateTagDTO {
    name: string;
    color: string;
    description?: string;
}

// DTO for updating a tag
export interface UpdateTagDTO {
    id: number;
    name?: string;
    color?: string;
    description?: string;
}
