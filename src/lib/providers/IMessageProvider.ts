/**
 * Message Provider Interface
 * 
 * Base interface for WhatsApp message providers.
 * Following DIP: High-level modules depend on this abstraction.
 */

export type ProviderType = 'whatsappjs' | 'ycloud';

/**
 * Result of a send operation
 */
export interface SendResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * Options for sending a message
 */
export interface SendOptions {
    mediaUrl?: string;
    mediaType?: string;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
    position: number;
    value: string;
}

/**
 * Interface for message providers
 */
export interface IMessageProvider {
    /**
     * Provider name for identification
     */
    readonly name: ProviderType;

    /**
     * Send a text message
     * @param phone Phone number (with country code)
     * @param message Message text
     * @param options Additional options
     */
    sendMessage(
        phone: string,
        message: string,
        options?: SendOptions
    ): Promise<SendResult>;

    /**
     * Send a template message (YCloud only)
     * @param phone Phone number (with country code)
     * @param templateName Name of the template in YCloud
     * @param variables Template variables
     * @param language Template language (default: pt_BR)
     */
    sendTemplateMessage?(
        phone: string,
        templateName: string,
        variables: TemplateVariable[],
        language?: string
    ): Promise<SendResult>;

    /**
     * Validate if a phone number is registered on WhatsApp
     * @param phone Phone number to validate
     */
    validateNumber?(phone: string): Promise<boolean>;

    /**
     * Check if the provider is ready to send messages
     */
    isReady(): Promise<boolean>;
}
