/**
 * Auto-Reply Types
 * TypeScript interfaces for auto-reply system
 */

export interface AutoReply {
    id: number;
    name: string;
    intent_description: string;
    example_messages: string[];
    response_template: string;
    is_active: boolean;
    priority: number;
    confidence_threshold: number;
    created_at: Date;
    updated_at: Date;
}

export interface CreateAutoReplyInput {
    name: string;
    intent_description: string;
    example_messages?: string[];
    response_template: string;
    is_active?: boolean;
    priority?: number;
    confidence_threshold?: number;
}

export interface UpdateAutoReplyInput {
    name?: string;
    intent_description?: string;
    example_messages?: string[];
    response_template?: string;
    is_active?: boolean;
    priority?: number;
    confidence_threshold?: number;
}

export interface AutoReplyLog {
    id: number;
    auto_reply_id: number | null;
    phone: string;
    message: string;
    detected_intent: string | null;
    confidence: number | null;
    response_sent: string | null;
    created_at: Date;
}

export interface CreateAutoReplyLogInput {
    auto_reply_id: number | null;
    phone: string;
    message: string;
    detected_intent: string | null;
    confidence: number | null;
    response_sent: string | null;
}

export interface IntentDetectionResult {
    intent: string;
    confidence: number;
    autoReplyId?: number;
}

export interface AutoReplyStats {
    total_sent_today: number;
    total_sent_week: number;
    total_sent_month: number;
    by_intent: {
        name: string;
        count: number;
    }[];
    avg_confidence: number;
}
