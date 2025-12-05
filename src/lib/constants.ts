/**
 * Centralized constants file
 * Eliminates magic numbers and provides single source of truth for configuration values
 */

// ============================================================================
// TEST CONSTANTS
// ============================================================================

/**
 * Wait times for async operations in tests
 */
export const TEST_TIMEOUTS = {
    /** Short wait for quick async operations (100ms) */
    SHORT: 100,
    /** Standard wait for most async operations (150ms) */
    STANDARD: 150,
    /** Long wait for complex operations like AI generation (200ms) */
    LONG: 200,
} as const;

// ============================================================================
// MESSAGE QUEUE CONSTANTS
// ============================================================================

/**
 * Message queue configuration
 */
export const QUEUE_CONFIG = {
    /** Maximum number of logs to keep in memory */
    MAX_LOGS_COUNT: 100,
    /** Default delay after session error (30 seconds) */
    SESSION_ERROR_DELAY_MS: 30000,
    /** Delay between message sends (configured per environment) */
    MIN_DELAY_MS: 1000,
    MAX_DELAY_MS: 3000,
} as const;

// ============================================================================
// WHATSAPP CONSTANTS
// ============================================================================

/**
 * WhatsApp client configuration
 */
export const WHATSAPP_CONFIG = {
    /** Delay before retrying connection (2 seconds) */
    RETRY_DELAY_MS: 2000,
    /** Polling interval for status checks (5 seconds) */
    STATUS_POLL_INTERVAL_MS: 5000,
    /** Delay between profile picture syncs (100ms) */
    PROFILE_SYNC_DELAY_MS: 100,
    /** Delay between history sync messages (200ms) */
    HISTORY_SYNC_DELAY_MS: 200,

    // Reconnection settings
    /** Maximum number of reconnection attempts before giving up */
    RECONNECT_MAX_ATTEMPTS: 5,
    /** Delays between reconnection attempts in milliseconds [30s, 1m, 2m, 4m, 5m] */
    RECONNECT_DELAYS_MS: [30000, 60000, 120000, 240000, 300000] as const,
    /** Health check interval (5 minutes) */
    HEALTH_CHECK_INTERVAL_MS: 5 * 60 * 1000,
    /** Cooldown period before allowing restart after critical error (1 minute) */
    RESTART_COOLDOWN_MS: 60000,
    /** Maximum number of restarts allowed within the restart window */
    MAX_RESTARTS_PER_WINDOW: 3,
    /** Time window for counting restarts (10 minutes) */
    RESTART_WINDOW_MS: 10 * 60 * 1000,
    /** Admin phone number for critical notifications */
    ADMIN_PHONE: '555181636027@c.us',
} as const;

// ============================================================================
// UI CONSTANTS
// ============================================================================

/**
 * Toast notification configuration
 */
export const TOAST_CONFIG = {
    /** Animation duration for toast fade out (300ms) */
    ANIMATION_DURATION_MS: 300,
    /** Default auto-dismiss time (5 seconds) */
    AUTO_DISMISS_MS: 5000,
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION = {
    /** Default items per page */
    DEFAULT_PAGE_SIZE: 25,
    /** Available page size options */
    PAGE_SIZE_OPTIONS: [10, 25, 50, 100] as const,
    /** Default page number */
    DEFAULT_PAGE: 1,
} as const;

/**
 * Debounce delays for user input
 */
export const DEBOUNCE = {
    /** Search input debounce (300ms) */
    SEARCH_MS: 300,
    /** Filter change debounce (300ms) */
    FILTER_MS: 300,
} as const;

// ============================================================================
// DATABASE CONSTANTS
// ============================================================================

/**
 * Database configuration
 */
export const DATABASE_CONFIG = {
    /** Default database filename */
    DB_FILENAME: 'crm.db',
    /** Production data directory */
    PROD_DATA_DIR: '/app/data',
} as const;

// ============================================================================
// API CONSTANTS
// ============================================================================

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * API Response Messages
 */
export const API_MESSAGES = {
    CPF_REQUIRED: 'CPF is required',
    INTERNAL_ERROR: 'Internal Server Error',
    LEAD_NOT_FOUND: 'Lead not found',
    DUPLICATE_CPF: 'CPF already exists',
} as const;

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

/**
 * Field length limits
 */
export const FIELD_LIMITS = {
    /** Maximum length for names */
    NAME_MAX_LENGTH: 255,
    /** Maximum length for email */
    EMAIL_MAX_LENGTH: 255,
    /** Maximum length for phone */
    PHONE_MAX_LENGTH: 20,
    /** CPF exact length */
    CPF_LENGTH: 11,
} as const;

// ============================================================================
// EXPORT TYPES
// ============================================================================

/**
 * Type-safe access to constant values
 */
export type TestTimeout = typeof TEST_TIMEOUTS[keyof typeof TEST_TIMEOUTS];
export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];
export type PageSize = typeof PAGINATION.PAGE_SIZE_OPTIONS[number];
