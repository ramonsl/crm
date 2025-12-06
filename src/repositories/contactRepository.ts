/**
 * Contact Repository - Data access layer for contacts
 * 
 * Follows DIP: Interface segregation, allows different implementations
 */

import db from '@/lib/db';

// Run migration to ensure columns exist
import '@/lib/migrations/addWhatsAppColumns';

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
 * SQLite implementation of contact repository
 */
export class SQLiteContactRepository implements IContactRepository {
    /**
     * Updates WhatsApp-related data for a contact
     * Handles both formats: with and without country code
     */
    async updateWhatsAppData(phone: string, data: WhatsAppData): Promise<void> {
        const phoneWithoutCountry = this.removeCountryCode(phone);

        const stmt = db.prepare(`
            UPDATE leads 
            SET whatsapp_valido = ?,
                profile_picture = ?,
                last_message = ?,
                last_message_time = ?
            WHERE telefone = ? OR telefone = ?
        `);

        stmt.run(
            data.whatsapp_valido ? 1 : 0,
            data.profile_picture,
            data.last_message,
            data.last_message_time,
            phone,
            phoneWithoutCountry
        );

        console.log(`[ContactRepository] Updated WhatsApp data for ${phone}`);
    }

    /**
     * Finds a contact by phone number
     */
    async findByPhone(phone: string): Promise<{ nome: string } | null> {
        const phoneWithoutCountry = this.removeCountryCode(phone);

        const stmt = db.prepare('SELECT nome FROM leads WHERE telefone = ? OR telefone = ?');
        const result = stmt.get(phone, phoneWithoutCountry) as { nome: string } | undefined;

        return result || null;
    }

    /**
     * Removes country code (55) from phone if present
     */
    private removeCountryCode(phone: string): string {
        return phone.startsWith('55') ? phone.substring(2) : phone;
    }
}
