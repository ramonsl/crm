/**
 * Logger Utility - Conditional logging based on environment
 * 
 * Follows Single Responsibility Principle (SRP):
 * This module is responsible ONLY for logging with environment awareness.
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   
 *   logger.debug('Only shows in development');
 *   logger.info('Always shows - important info');
 *   logger.warn('Always shows - warnings');
 *   logger.error('Always shows - errors');
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
    /** Whether debug logs are enabled */
    debugEnabled: boolean;
    /** Prefix for all log messages */
    prefix?: string;
    /** Whether to include timestamps */
    timestamps?: boolean;
    /** Keys to redact from logs (for pino compatibility if extended later) */
    redact?: string[];
}

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Default configuration
 */
const defaultConfig: LoggerConfig = {
    debugEnabled: isDevelopment && !isTest,
    timestamps: false,
    redact: ['apiKey', 'password', 'token', 'secret', '*.apiKey', '*.password', '*.token', '*.secret'],
};

/**
 * Format a log message with optional prefix and timestamp
 */
function formatMessage(level: LogLevel, prefix: string | undefined, args: unknown[]): unknown[] {
    const parts: unknown[] = [];

    if (prefix) {
        parts.push(`[${prefix}]`);
    }

    return [...parts, ...args];
}

/**
 * Creates a logger instance with the given configuration
 */
function createLogger(config: Partial<LoggerConfig> = {}) {
    const finalConfig = { ...defaultConfig, ...config };

    return {
        /**
         * Debug logs - Only shown in development
         * Use for detailed debugging information
         */
        debug: (...args: unknown[]) => {
            if (finalConfig.debugEnabled) {
                // eslint-disable-next-line no-console
                console.log(...formatMessage('debug', finalConfig.prefix, args));
            }
        },

        /**
         * Info logs - Always shown
         * Use for important operational information
         */
        info: (...args: unknown[]) => {
            // eslint-disable-next-line no-console
            console.log(...formatMessage('info', finalConfig.prefix, args));
        },

        /**
         * Warning logs - Always shown
         * Use for potential issues that don't break functionality
         */
        warn: (...args: unknown[]) => {
            // eslint-disable-next-line no-console
            console.warn(...formatMessage('warn', finalConfig.prefix, args));
        },

        /**
         * Error logs - Always shown
         * Use for errors and exceptions
         */
        error: (...args: unknown[]) => {
            // eslint-disable-next-line no-console
            console.error(...formatMessage('error', finalConfig.prefix, args));
        },

        /**
         * Create a child logger with a specific prefix
         * Useful for module-specific logging
         */
        child: (prefix: string) => {
            return createLogger({ ...finalConfig, prefix });
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
export const logger = createLogger();

/**
 * Pre-configured loggers for common modules
 * 
 * Following DIP: Each module imports the logger it needs,
 * allowing for easy testing and configuration changes.
 */

// Infrastructure loggers
export const whatsappLogger = createLogger({ prefix: 'WhatsApp' });
export const socketLogger = createLogger({ prefix: 'Socket' });
export const dbLogger = createLogger({ prefix: 'DB' });

// API layer loggers
export const apiLogger = createLogger({ prefix: 'API' });

// Service layer loggers
export const autoReplyLogger = createLogger({ prefix: 'AutoReply' });
export const chatLogger = createLogger({ prefix: 'Chat' });
export const tagLogger = createLogger({ prefix: 'Tags' });
export const syncLogger = createLogger({ prefix: 'Sync' });
export const queueLogger = createLogger({ prefix: 'Queue' });
export const authLogger = createLogger({ prefix: 'Auth' });
export const yCloudLogger = createLogger({ prefix: 'YCloud' });

// Frontend loggers (for React components/contexts)
export const uiLogger = createLogger({ prefix: 'UI' });

/**
 * Export factory for custom loggers
 */
export { createLogger };

/**
 * Type exports for external use
 */
export type { LoggerConfig, LogLevel };
