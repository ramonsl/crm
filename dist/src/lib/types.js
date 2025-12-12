"use strict";
/**
 * Centralized type definitions for the CRM application
 * Eliminates use of 'any' and provides type safety
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStandardError = isStandardError;
exports.getErrorMessage = getErrorMessage;
/**
 * Type guard for StandardError
 */
function isStandardError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string');
}
/**
 * Safely extract error message
 */
function getErrorMessage(error) {
    if (isStandardError(error)) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error';
}
