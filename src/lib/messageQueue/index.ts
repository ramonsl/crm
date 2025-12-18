/**
 * MessageQueue Module - Public API
 * 
 * This is the main entry point for the message queue.
 * Provides backwards-compatible API while using the refactored modular architecture.
 * 
 * Following Facade Pattern: Single entry point to complex subsystem.
 */

import { QueueManager } from './QueueManager';
import { AIMessageGenerator } from './AIMessageGenerator';
import { MessageHistoryRecorder } from './MessageHistoryRecorder';
import { SettingsProvider } from './SettingsProvider';

// Export types for external use
export type {
    QueueItem,
    QueueLog,
    QueueState,
    QueueStats,
    DelaySettings,
    EnqueueOptions,
    QueueItemStatus,
    LogType
} from './types';

// Export interfaces for testing/extension
export type {
    IAIMessageGenerator,
    IMessageHistoryRecorder,
    ISettingsProvider,
    IMessageSender
} from './interfaces';

// Export classes for testing/extension
export { QueueManager } from './QueueManager';
export { AIMessageGenerator } from './AIMessageGenerator';
export { MessageHistoryRecorder } from './MessageHistoryRecorder';
export { SettingsProvider } from './SettingsProvider';

// ============================================================================
// SINGLETON INSTANTIATION
// ============================================================================

// Declare global for singleton preservation across imports
declare global {
    var messageQueueModuleInstance: QueueManager | undefined;
}

// Create singleton instances
const settingsProvider = new SettingsProvider();
const aiGenerator = new AIMessageGenerator(settingsProvider);
const historyRecorder = new MessageHistoryRecorder();

// Get or create singleton queue manager
if (!global.messageQueueModuleInstance) {
    global.messageQueueModuleInstance = new QueueManager(
        aiGenerator,
        historyRecorder,
        settingsProvider
    );
}

/**
 * The singleton message queue instance
 * 
 * @example
 * import { messageQueue } from '@/lib/messageQueue';
 * 
 * messageQueue.enqueue([{ phone: '5551999999999', message: 'Hello!' }]);
 * const state = messageQueue.getState();
 */
export const messageQueue = global.messageQueueModuleInstance;
