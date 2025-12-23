/**
 * ContactSyncService - Orchestrates WhatsApp data synchronization
 * 
 * Follows SRP: Only responsible for coordinating the sync process
 * Reuses existing services: validator, getContactProfilePicture, etc.
 */

import type { WhatsAppValidator, ValidationResult } from './whatsappValidator';
import type { IContactRepository, WhatsAppData } from '@/repositories/contactRepository';
import { syncLogger } from '@/lib/logger';

export interface SyncResult {
    valid: boolean;
    chatId: string | null;
    profilePicture: string | null;
    lastMessage: string | null;
    lastMessageTime: string | null;
    updated: boolean;
    error?: string;
}

export class ContactSyncService {
    constructor(
        private validator: WhatsAppValidator,
        private contactRepo: IContactRepository
    ) { }

    /**
     * Synchronizes WhatsApp data for a contact
     * 1. Validates WhatsApp number
     * 2. Fetches profile picture (reuses existing function)
     * 3. Fetches last chat message
     * 4. Updates database
     */
    async syncContact(phone: string): Promise<SyncResult> {
        try {
            // Step 1: Validate
            const validation = await this.validator.validate(phone);

            if (!validation.valid) {
                await this.markAsInvalid(phone);
                return this.createInvalidResult();
            }

            // Step 2-3: Fetch profile and last chat in parallel
            const [profilePicture, lastChat] = await Promise.all([
                this.fetchProfilePicture(phone),
                this.fetchLastChat(validation.chatId!)
            ]);

            // Step 4: Update database
            await this.updateDatabase(phone, {
                whatsapp_valido: true,
                profile_picture: profilePicture,
                last_message: lastChat?.message,
                last_message_time: lastChat?.time
            });

            return {
                valid: true,
                chatId: validation.chatId,
                profilePicture,
                lastMessage: lastChat?.message || null,
                lastMessageTime: lastChat?.time || null,
                updated: true
            };

        } catch (error) {
            syncLogger.error('Sync error:', error);
            return {
                valid: false,
                chatId: null,
                profilePicture: null,
                lastMessage: null,
                lastMessageTime: null,
                updated: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Fetches profile picture using existing WhatsApp function
     */
    private async fetchProfilePicture(phone: string): Promise<string | null> {
        try {
            const { getContactProfilePicture } = await import('@/lib/whatsapp');
            return await getContactProfilePicture(phone);
        } catch (error) {
            syncLogger.warn('Failed to fetch profile picture:', error);
            return null;
        }
    }

    /**
     * Fetches last chat message
     */
    private async fetchLastChat(chatId: string): Promise<{ message: string; time: string } | null> {
        try {
            const chat = await global.whatsappClient!.getChatById(chatId);
            const messages = await chat.fetchMessages({ limit: 1 });

            if (messages.length > 0) {
                const msg = messages[0];
                return {
                    message: msg.body,
                    time: new Date(msg.timestamp * 1000).toISOString()
                };
            }
        } catch (error) {
            syncLogger.warn('Failed to fetch last chat:', error);
        }

        return null;
    }

    /**
     * Updates database with WhatsApp data
     */
    private async updateDatabase(phone: string, data: WhatsAppData): Promise<void> {
        await this.contactRepo.updateWhatsAppData(phone, data);
    }

    /**
     * Marks contact as invalid in database
     */
    private async markAsInvalid(phone: string): Promise<void> {
        await this.contactRepo.updateWhatsAppData(phone, {
            whatsapp_valido: false,
            profile_picture: null,
            last_message: null,
            last_message_time: null
        });
    }

    /**
     * Creates result object for invalid number
     */
    private createInvalidResult(): SyncResult {
        return {
            valid: false,
            chatId: null,
            profilePicture: null,
            lastMessage: null,
            lastMessageTime: null,
            updated: true  // Still updated (marked as invalid)
        };
    }
}
