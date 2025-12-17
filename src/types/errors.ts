/**
 * Error Type Definitions
 * 
 * Enhanced error types for better error handling
 */

/**
 * API Error with HTTP status code
 */
export interface ApiError extends Error {
    statusCode?: number;
    details?: unknown;
}

/**
 * Union type for catch blocks
 * Use this instead of 'any' in catch statements
 */
export type CatchError = Error | ApiError | unknown;

/**
 * Type guard for Error objects
 */
export function isError(error: unknown): error is Error {
    return error instanceof Error;
}

/**
 * Type guard for ApiError objects
 */
export function isApiError(error: unknown): error is ApiError {
    return isError(error) && 'statusCode' in error;
}

/**
 * Safely extract error stack from unknown error
 */
export function getErrorStack(error: CatchError): string | undefined {
    if (isError(error)) {
        return error.stack;
    }
    return undefined;
}

/**
 * Note: getErrorMessage() already exists in @/lib/types
 * Import from there: import { getErrorMessage } from '@/lib/types';
 */
