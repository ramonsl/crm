/**
 * Queue Automation Types
 * 
 * Type definitions for the queue idle automation feature.
 */

export type MessageType = 'fixed' | 'ai';

export interface QueueAutomationConfig {
    id: number;
    templateId: number | null;
    targetStatus: string | null;
    messageType: MessageType;
    isActive: boolean;
    startHour: number;
    endHour: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface QueueAutomationLog {
    id: number;
    leadCpf: string;
    templateId: number | null;
    sentAt: Date;
    success: boolean;
    errorMessage: string | null;
}

export interface QueueAutomationStatus {
    isActive: boolean;
    isRunning: boolean;
    isWithinOperatingHours: boolean;
    currentHourBrazil: number;
    totalSent: number;
    lastSentAt: Date | null;
    queueLength: number;
}
