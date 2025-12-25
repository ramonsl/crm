/**
 * MessageQueue Types
 * 
 * Shared types for the message queue module.
 * Following SRP: Only type definitions.
 */

import type { ProviderType } from '../providers/IMessageProvider';

/**
 * Status of a queue item
 */
export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Variable for YCloud templates
 */
export interface TemplateVariableValue {
    position: number;
    value: string;
}

/**
 * Represents a message in the queue
 */
export interface QueueItem {
    id: string;
    phone: string;
    message: string;
    name?: string;
    cpf?: string;
    isAi?: boolean;
    templateId?: number;
    templateName?: string;
    provider?: ProviderType;
    variables?: TemplateVariableValue[];
    status: QueueItemStatus;
    addedAt: Date;
}

/**
 * Log entry type
 */
export type LogType = 'info' | 'success' | 'error';

/**
 * A log entry for queue operations
 */
export interface QueueLog {
    timestamp: Date;
    message: string;
    type: LogType;
}

/**
 * Queue statistics
 */
export interface QueueStats {
    total: number;
    processed: number;
    failed: number;
}

/**
 * Delay settings for message sending
 */
export interface DelaySettings {
    minDelay: number;
    maxDelay: number;
}

/**
 * Current state of the queue
 */
export interface QueueState {
    queueLength: number;
    processing: boolean;
    logs: QueueLog[];
    stats: QueueStats;
    currentItem: QueueItem | null;
    estimatedTimeRemaining: number;
}

/**
 * Options for enqueueing a message
 */
export interface EnqueueOptions {
    phone: string;
    message?: string;
    name?: string;
    cpf?: string;
    isAi?: boolean;
    templateId?: number;
    templateName?: string;
    provider?: ProviderType;
    variables?: TemplateVariableValue[];
}

