import { whatsappLogger } from '@/lib/logger';

/**
 * Base abstract class for WhatsApp Adapters
 * Centralizes common logic like phone normalization and ID resolution
 */
export abstract class BaseWhatsAppAdapter {
    /**
     * Abstract method to verify if a number exists on the specific WhatsApp network
     * Must be implemented by concrete adapters (Baileys, WPPConnect, etc)
     * 
     * @param jid - The candidate JID (e.g. 555199998888@s.whatsapp.net)
     * @returns The canonical JID if exists, null otherwise
     */
    protected abstract verifyJidOnNetwork(jid: string): Promise<string | null>;

    /**
     * Helper to normalize phone and get correct JID from WhatsApp
     * Handles +55 prefix and 8 vs 9 digit issues logic centrally
     */
    protected async getChatId(phone: string, isGroup: boolean = false): Promise<string> {
        // If it's a group or already has domain, assume it's valid
        if (phone.includes('@') || isGroup) return phone;

        // Sanitize - remove message formatting
        let clean = phone.replace(/\D/g, '');

        // Add Brazil DDI (55) if it looks like a local mobile/landline (10 or 11 digits)
        // DDD + NUMBER = 10 or 11
        if (clean.length >= 10 && clean.length <= 11) {
            clean = '55' + clean;
        }

        // Determine domain suffix (default to standard, concrete adapters can override logic if needed)
        // Note: WPPConnect uses @c.us, Baileys uses @s.whatsapp.net. 
        // We will pass the raw number to verifyJidOnNetwork and let it handle/append suffix if needed checking,
        // or we define a standard suffix here.
        // Actually, it's safer to let the concrete adapter decide the suffix convention in verifyJidOnNetwork 
        // OR we make verifyJidOnNetwork accept the clean number.

        // Let's pass the clean number to the abstract method? 
        // No, verifyJidOnNetwork implies checking a JID.
        // Let's assume standard suffix for connection check and let adapter fix it.
        // Wait, WPPConnect needs @c.us, Baileys needs @s.whatsapp.net for checking.
        // So the suffix depends on the impl.

        // Better: normalizePhoneOnly then let calling code handle suffix?
        // No, we want getChatId to return the full JID.

        // Let's try to verify with the specific implementation
        try {
            const canonicalJid = await this.verifyJidOnNetwork(clean);
            if (canonicalJid) {
                return canonicalJid;
            }
        } catch (e) {
            whatsappLogger.warn(`Failed to verify phone on network: ${clean}`, e);
        }

        // Fallback: Return format specific to adapter? 
        // We can't know the suffix here easily without configuration.
        // Let's make getSuffix() abstract too?
        return this.formatToDefaultJid(clean);
    }

    /**
     * Formats a clean number to the default JID format for this provider
     * e.g. number@s.whatsapp.net or number@c.us
     */
    protected abstract formatToDefaultJid(number: string): string;
}
