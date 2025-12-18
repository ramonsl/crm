/**
 * MessageQueue - Backwards Compatibility Layer
 * 
 * This file re-exports the refactored messageQueue module for backwards compatibility.
 * All imports from '@/lib/messageQueue' will continue to work.
 * 
 * The actual implementation is now in src/lib/messageQueue/ directory following:
 * - SRP: Separated into QueueManager, AIMessageGenerator, MessageHistoryRecorder
 * - DIP: Uses interfaces for dependencies
 * 
 * @see src/lib/messageQueue/index.ts for the new modular structure
 */

// Re-export everything from the new module
export * from './messageQueue/index';

// Export messageQueue as default for compatibility
export { messageQueue as default } from './messageQueue/index';

