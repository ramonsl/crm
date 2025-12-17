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
}

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Default configuration
 */
const defaultConfig: LoggerConfig = {
    debugEnabled: isDevelopment && !isTest,
    timestamps: false,
};

/**
 * Format a log message with optional prefix and timestamp
 */
function formatMessage(level: LogLevel, prefix: string | undefined, args: any[]): any[] {
    const parts: any[] = [];

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
        debug: (...args: any[]) => {
            if (finalConfig.debugEnabled) {
                console.log(...formatMessage('debug', finalConfig.prefix, args));
            }
        },

        /**
         * Info logs - Always shown
         * Use for important operational information
         */
        info: (...args: any[]) => {
            console.log(...formatMessage('info', finalConfig.prefix, args));
        },

        /**
         * Warning logs - Always shown
         * Use for potential issues that don't break functionality
         */
        warn: (...args: any[]) => {
            console.warn(...formatMessage('warn', finalConfig.prefix, args));
        },

        /**
         * Error logs - Always shown
         * Use for errors and exceptions
         */
        error: (...args: any[]) => {
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
 */
export const whatsappLogger = createLogger({ prefix: 'WhatsApp' });
export const socketLogger = createLogger({ prefix: 'Socket' });
export const dbLogger = createLogger({ prefix: 'DB' });
export const apiLogger = createLogger({ prefix: 'API' });

/**
 * Export factory for custom loggers
 */
export { createLogger };

/**
 * Type exports for external use
 */
export type { LoggerConfig, LogLevel };
