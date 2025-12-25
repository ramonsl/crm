"use strict";
/**
 * Logger Utility - Conditional logging based on environment
 *
 * Follows Single Responsibility Principle (SRP):
 * This module is responsible ONLY for logging with environment awareness.
 *
 * Usage:
 *   import { logger } from '../lib/logger';
 *
 *   logger.debug('Only shows in development');
 *   logger.info('Always shows - important info');
 *   logger.warn('Always shows - warnings');
 *   logger.error('Always shows - errors');
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.uiLogger = exports.yCloudLogger = exports.authLogger = exports.queueLogger = exports.syncLogger = exports.tagLogger = exports.chatLogger = exports.autoReplyLogger = exports.apiLogger = exports.dbLogger = exports.socketLogger = exports.whatsappLogger = exports.logger = void 0;
exports.createLogger = createLogger;
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
/**
 * Default configuration
 */
const defaultConfig = {
    debugEnabled: isDevelopment && !isTest,
    timestamps: false,
};
/**
 * Format a log message with optional prefix and timestamp
 */
function formatMessage(level, prefix, args) {
    const parts = [];
    if (prefix) {
        parts.push(`[${prefix}]`);
    }
    return [...parts, ...args];
}
/**
 * Creates a logger instance with the given configuration
 */
function createLogger(config = {}) {
    const finalConfig = Object.assign(Object.assign({}, defaultConfig), config);
    return {
        /**
         * Debug logs - Only shown in development
         * Use for detailed debugging information
         */
        debug: (...args) => {
            if (finalConfig.debugEnabled) {
                console.log(...formatMessage('debug', finalConfig.prefix, args));
            }
        },
        /**
         * Info logs - Always shown
         * Use for important operational information
         */
        info: (...args) => {
            console.log(...formatMessage('info', finalConfig.prefix, args));
        },
        /**
         * Warning logs - Always shown
         * Use for potential issues that don't break functionality
         */
        warn: (...args) => {
            console.warn(...formatMessage('warn', finalConfig.prefix, args));
        },
        /**
         * Error logs - Always shown
         * Use for errors and exceptions
         */
        error: (...args) => {
            console.error(...formatMessage('error', finalConfig.prefix, args));
        },
        /**
         * Create a child logger with a specific prefix
         * Useful for module-specific logging
         */
        child: (prefix) => {
            return createLogger(Object.assign(Object.assign({}, finalConfig), { prefix }));
        },
        /**
         * Check if debug logging is enabled
         */
        isDebugEnabled: () => finalConfig.debugEnabled,
    };
}
/**
 * Default logger instance
 */
exports.logger = createLogger();
/**
 * Pre-configured loggers for common modules
 *
 * Following DIP: Each module imports the logger it needs,
 * allowing for easy testing and configuration changes.
 */
// Infrastructure loggers
exports.whatsappLogger = createLogger({ prefix: 'WhatsApp' });
exports.socketLogger = createLogger({ prefix: 'Socket' });
exports.dbLogger = createLogger({ prefix: 'DB' });
// API layer loggers
exports.apiLogger = createLogger({ prefix: 'API' });
// Service layer loggers
exports.autoReplyLogger = createLogger({ prefix: 'AutoReply' });
exports.chatLogger = createLogger({ prefix: 'Chat' });
exports.tagLogger = createLogger({ prefix: 'Tags' });
exports.syncLogger = createLogger({ prefix: 'Sync' });
exports.queueLogger = createLogger({ prefix: 'Queue' });
exports.authLogger = createLogger({ prefix: 'Auth' });
exports.yCloudLogger = createLogger({ prefix: 'YCloud' });
// Frontend loggers (for React components/contexts)
exports.uiLogger = createLogger({ prefix: 'UI' });
