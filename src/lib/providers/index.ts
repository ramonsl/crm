/**
 * Message Providers Module
 * 
 * Public API for message providers.
 * Exports all types and factory functions.
 */

// Types
export type {
    IMessageProvider,
    SendResult,
    SendOptions,
    ProviderType,
    TemplateVariable
} from './IMessageProvider';

// Providers
export { WhatsAppJSProvider } from './WhatsAppJSProvider';
export { YCloudProvider } from './YCloudProvider';

// Factory
export {
    getProvider,
    getActiveProvider,
    getActiveProviderType
} from './ProviderFactory';
