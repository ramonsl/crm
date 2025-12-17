"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStandardError = isStandardError;
exports.safeGetErrorMessage = safeGetErrorMessage;
exports.getErrorMessage = safeGetErrorMessage;
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
function safeGetErrorMessage(error) {
    if (isStandardError(error)) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error';
}
