/**
 * MessageQueue Interfaces
 * 
 * Contracts for message queue components.
 * Following DIP: Depend on abstractions, not concretions.
 */

import type { QueueItem } from './types';

/**
 * Interface for AI message generation
 * Following SRP: Only responsible for generating AI messages
 */
export interface IAIMessageGenerator {
    /**
     * Generate a message using AI
     * @param prompt - The prompt/template to send to AI
     * @param name - Optional recipient name for personalization
     * @returns The generated message
     */
    generate(prompt: string, name?: string): Promise<string>;
}

/**
 * Interface for recording message history
 * Following SRP: Only responsible for recording message history
 */
export interface IMessageHistoryRecorder {
    /**
     * Record a successful message send
     * @param item - The queue item that was sent
     */
    recordSuccess(item: QueueItem): Promise<void>;

    /**
     * Record a failed message send
     * @param item - The queue item that failed
     */
    recordFailure(item: QueueItem): Promise<void>;
}

/**
 * Interface for message sending
 * Allows dependency injection of the messenger
 */
export interface IMessageSender {
    /**
     * Send a message to a phone number
     * @param phone - Recipient phone number
     * @param message - Message content
     */
    send(phone: string, message: string): Promise<{ id: string }>;
}

/**
 * Interface for settings retrieval
 * Allows dependency injection of settings source
 */
export interface ISettingsProvider {
    /**
     * Get a setting value by key
     * @param key - Setting key
     */
    get(key: string): Promise<string | null>;

    /**
     * Get multiple settings by keys
     * @param keys - Array of setting keys
     */
    getMultiple(keys: string[]): Promise<{ key: string; value: string }[]>;
}
