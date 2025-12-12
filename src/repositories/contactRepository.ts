/**
 * Contact Repository - Data access layer for contacts
 * 
 * Follows DIP: Interface segregation, allows different implementations
 * Uses Neon PostgreSQL for data persistence.
 */

import { pool, query, execute } from '@/lib/db';

export interface WhatsAppData {
    whatsapp_valido: boolean;
    profile_picture?: string | null;
    last_message?: string | null;
    last_message_time?: string | null;
}

/**
 * Interface for contact repository
 * Allows dependency inversion - easy to swap implementations or mock for tests
 */
export interface IContactRepository {
    updateWhatsAppData(phone: string, data: WhatsAppData): Promise<void>;
    findByPhone(phone: string): Promise<{ nome: string } | null>;
}

/**
 * PostgreSQL implementation of contact repository
 */
export class NeonContactRepository implements IContactRepository {
    /**
     * Updates WhatsApp-related data for a contact
     * Handles both formats: with and without country code
     */
    async updateWhatsAppData(phone: string, data: WhatsAppData): Promise<void> {
        const phoneWithoutCountry = this.removeCountryCode(phone);

        await pool.query(`
            UPDATE leads 
            SET whatsapp_valido = $1,
                profile_picture = $2,
                last_message = $3,
                last_message_time = $4
            WHERE telefone = $5 OR telefone = $6
        `, [
            data.whatsapp_valido ? 1 : 0,
            data.profile_picture,
            data.last_message,
            data.last_message_time,
            phone,
            phoneWithoutCountry
        ]);

        console.log(`[ContactRepository] Updated WhatsApp data for ${phone}`);
    }

    /**
     * Finds a contact by phone number
     */
    async findByPhone(phone: string): Promise<{ nome: string } | null> {
        const phoneWithoutCountry = this.removeCountryCode(phone);

        const result = await pool.query(
            'SELECT nome FROM leads WHERE telefone = $1 OR telefone = $2 LIMIT 1',
            [phone, phoneWithoutCountry]
        );

        return result.rows[0] || null;
    }

    /**
     * Removes country code (55) from phone if present
     */
    private removeCountryCode(phone: string): string {
        return phone.startsWith('55') ? phone.substring(2) : phone;
    }
}

// Alias for backward compatibility
export const SQLiteContactRepository = NeonContactRepository;
