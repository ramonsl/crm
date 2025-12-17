import { getErrorMessage } from '@/lib/types';

/**
 * API Route - Sync WhatsApp Contact Data
 * POST /api/contacts/sync-whatsapp
 * 
 * Validates WhatsApp number and synchronizes contact data
 */

import { NextRequest, NextResponse } from 'next/server';
import { SQLiteContactRepository } from '@/repositories/contactRepository';

export async function POST(req: NextRequest) {
    try {
        const { phone } = await req.json();

        if (!phone) {
            return NextResponse.json(
                { error: 'Phone number is required' },
                { status: 400 }
            );
        }

        console.log(`[API Sync] Syncing ${phone}...`);
        console.log(`[API Sync] WhatsApp status: ${global.whatsappStatus}`);
        console.log(`[API Sync] WhatsApp client exists: ${!!global.whatsappClient}`);

        // Warn if WhatsApp might not be ready, but continue anyway
        if (!global.whatsappClient || global.whatsappStatus !== 'ready') {
            console.warn('[API Sync] ⚠️ Warning: WhatsApp may not be ready, but will try anyway');
        }

        // Format phone - add 55 if needed
        let formattedPhone = phone.replace(/\D/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = formattedPhone.substring(1);
        }
        if (formattedPhone.length === 10 || formattedPhone.length === 11) {
            formattedPhone = '55' + formattedPhone;
        }

        console.log(`[API Sync] Formatted phone: ${formattedPhone}`);

        let chatId: string | null = null;
        let valid = false;

        // Try to get WhatsApp ID - test both 12 and 13 digit versions
        const variations = [];

        if (formattedPhone.length === 13) {
            // 5551999998888 -> try both with and without 9
            const without9 = formattedPhone.substring(0, 4) + formattedPhone.substring(5);
            variations.push(without9, formattedPhone);
        } else if (formattedPhone.length === 12) {
            // 555198888888 -> try both as-is and with 9
            const with9 = formattedPhone.substring(0, 4) + '9' + formattedPhone.substring(4);
            variations.push(formattedPhone, with9);
        } else {
            variations.push(formattedPhone);
        }

        console.log(`[API Sync] Trying variations:`, variations);

        for (const variant of variations) {
            try {
                console.log(`[API Sync] Testing +${variant}...`);
                const result = await global.whatsappClient!.getNumberId(`+${variant}`);

                if (result && result._serialized) {
                    chatId = result._serialized;
                    valid = true;
                    console.log(`[API Sync] ✅ Found! ChatId: ${chatId}`);
                    break;
                }
            } catch (error) {
                console.log(`[API Sync] ❌ +${variant} not found`);
            }
        }

        console.log(`[API Sync] Final result - Valid: ${valid}, ChatId: ${chatId}`);

        let profilePicture = null;
        let lastMessage = null;
        let lastMessageTime = null;

        // If valid, fetch additional data
        if (valid && chatId) {
            try {
                // Fetch profile picture
                const { getContactProfilePicture } = await import('@/lib/whatsapp');
                profilePicture = await getContactProfilePicture(phone);
                console.log(`[API Sync] Profile picture: ${profilePicture ? 'found' : 'not found'}`);

                // Fetch last chat
                const chat = await global.whatsappClient!.getChatById(chatId);
                const messages = await chat.fetchMessages({ limit: 1 });

                if (messages.length > 0) {
                    lastMessage = messages[0].body;
                    lastMessageTime = new Date(messages[0].timestamp * 1000).toISOString();
                    console.log(`[API Sync] Last message: ${lastMessage?.substring(0, 30)}...`);
                }
            } catch (error) {
                console.warn('[API Sync] Failed to fetch additional data:', error);
            }
        }

        // Update database
        const repository = new SQLiteContactRepository();
        await repository.updateWhatsAppData(phone, {
            whatsapp_valido: valid,
            profile_picture: profilePicture,
            last_message: lastMessage,
            last_message_time: lastMessageTime
        });

        console.log(`[API Sync] ✅ Updated database for ${phone}`);

        return NextResponse.json({
            valid,
            chatId,
            profilePicture,
            lastMessage,
            lastMessageTime,
            updated: true
        });

    } catch (error: unknown) {
        console.error('[API Sync] Error:', error);
        return NextResponse.json(
            { error: getErrorMessage(error) || 'Synchronization failed' },
            { status: 500 }
        );
    }
}
