/**
 * API Route - Sync WhatsApp Contact Data
 * POST /api/contacts/sync-whatsapp
 * 
 * Validates WhatsApp number and synchronizes contact data
 * Refatorado para usar WhatsAppProviderFactory
 */

import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory/WhatsAppProviderFactory';
import { SQLiteContactRepository } from '@/repositories/contactRepository';
import { getErrorMessage } from '@/lib/types';

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

        // Get provider via Factory
        const provider = await WhatsAppProviderFactory.getProvider();
        const isReady = await provider.isReady();

        console.log(`[API Sync] Provider ready: ${isReady}`);

        if (!isReady) {
            console.warn('[API Sync] ⚠️ Warning: WhatsApp may not be ready');
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

        // Validate number via provider
        let chatId: string | null = null;
        let valid = false;

        try {
            const validatedNumber = await provider.validateNumber(formattedPhone);
            if (validatedNumber) {
                chatId = `${validatedNumber}@s.whatsapp.net`;
                valid = true;
                console.log(`[API Sync] ✅ Valid! ChatId: ${chatId}`);
            } else {
                console.log(`[API Sync] ❌ Number not valid on WhatsApp`);
            }
        } catch (error) {
            console.warn('[API Sync] Validation error:', error);
        }

        let profilePicture = null;

        // If valid, fetch profile picture
        if (valid) {
            try {
                profilePicture = await provider.getProfilePicture(formattedPhone);
                console.log(`[API Sync] Profile picture: ${profilePicture ? 'found' : 'not found'}`);
            } catch (error) {
                console.warn('[API Sync] Failed to fetch profile picture:', error);
            }
        }

        // Update database
        const repository = new SQLiteContactRepository();
        await repository.updateWhatsAppData(phone, {
            whatsapp_valido: valid,
            profile_picture: profilePicture,
            last_message: null,  // Mensagens são sincronizadas via message handler
            last_message_time: null
        });

        console.log(`[API Sync] ✅ Updated database for ${phone}`);

        return NextResponse.json({
            valid,
            chatId,
            profilePicture,
            lastMessage: null,
            lastMessageTime: null,
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
