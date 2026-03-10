/**
 * WhatsApp Group Service
 * 
 * Responsibility: Handle WhatsApp group operations
 * - Find groups by name
 * - Send messages to groups
 * - List available groups
 * 
 * Follows Single Responsibility Principle
 */

import { WhatsAppProviderFactory } from '../lib/whatsapp';
import { WhatsAppProviderManager } from '../lib/whatsapp/manager/WhatsAppProviderManager';
import { IdempotencyRepository } from '@/lib/repositories/IdempotencyRepository';

export interface WhatsAppGroup {
    id: string;
    name: string;
    participantCount: number;
}

interface SendGroupOptions {
    idempotencyKey?: string;
    idempotencyTtlSeconds?: number;
}

export class WhatsAppGroupService {
    private idempotencyRepo = new IdempotencyRepository();

    /**
     * Get all available WhatsApp groups
     */
    async listGroups(): Promise<WhatsAppGroup[]> {
        const provider = await WhatsAppProviderFactory.getProvider();

        if (!provider) {
            throw new Error('WhatsApp provider not ready. Please connect WhatsApp first.');
        }

        try {
            console.log('[WhatsAppGroupService] Fetching groups...');
            const groupsMetadata = await provider.listGroups();
            console.log('[WhatsAppGroupService] Total groups found:', groupsMetadata.length);

            const groups = groupsMetadata.map(group => ({
                id: group.id,
                name: group.subject,
                participantCount: group.participants?.length || 0
            }));

            return groups;
        } catch (error) {
            console.error('[WhatsAppGroupService] Error listing groups:', error);
            throw new Error('Failed to list groups: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Find group by name (case insensitive)
     */
    async findGroupByName(groupName: string): Promise<WhatsAppGroup | null> {
        const groups = await this.listGroups();
        const normalized = groupName.toLowerCase().trim();

        const found = groups.find(g =>
            g.name.toLowerCase().trim() === normalized
        );

        return found || null;
    }

    /**
     * Send message to group by name
     * Reuses existing WhatsApp client infrastructure
     */
    async sendToGroupByName(groupName: string, message: string): Promise<void> {
        const group = await this.findGroupByName(groupName);

        if (!group) {
            throw new Error(`Group "${groupName}" not found`);
        }

        await this.sendToGroupById(group.id, message);
    }

    /**
     * Send message to group by ID
     */
    async sendToGroupById(groupId: string, message: string, options?: SendGroupOptions): Promise<void> {
        // We MUST use the Web Provider (Baileys) for groups, because Official APIs (YCloud) 
        // do not support sending messages to standard @g.us groups.
        const provider = await WhatsAppProviderManager.getInstance().getWebProvider();

        if (!provider) {
            throw new Error('WhatsApp provider not ready. Please connect WhatsApp first.');
        }

        const idempotencyKey = options?.idempotencyKey;
        const idempotencyTtlSeconds = options?.idempotencyTtlSeconds ?? 24 * 60 * 60;

        if (idempotencyKey) {
            const acquired = await this.idempotencyRepo.acquire(
                idempotencyKey,
                idempotencyTtlSeconds,
                { groupId }
            );

            if (!acquired) {
                console.log(`[WhatsAppGroupService] Skipping duplicate send for key ${idempotencyKey}`);
                return;
            }
        }

        try {
            console.log(`[WhatsAppGroupService] Sending message to group ${groupId}`);

            const result = await provider.sendTextMessage(groupId, message);

            if (!result.success) {
                throw new Error(result.error || 'Failed to send message');
            }

            console.log(`[WhatsAppGroupService] ✅ Message sent successfully to group ${groupId}`);
        } catch (error) {
            if (idempotencyKey) {
                await this.idempotencyRepo.release(idempotencyKey);
            }
            console.error('[WhatsAppGroupService] ❌ Error sending message:', error);
            throw new Error('Failed to send message: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Send multiple messages with delay
     * Prevents spam/blocking
     */
    async sendBatchMessages(
        groupName: string,
        messages: string[],
        delayMs: number = 2000
    ): Promise<void> {
        const group = await this.findGroupByName(groupName);

        if (!group) {
            throw new Error(`Group "${groupName}" not found`);
        }

        for (let i = 0; i < messages.length; i++) {
            await this.sendToGroupById(group.id, messages[i]);

            // Add delay between messages (except for last one)
            if (i < messages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
}

// Export singleton instance
export const whatsAppGroupService = new WhatsAppGroupService();
