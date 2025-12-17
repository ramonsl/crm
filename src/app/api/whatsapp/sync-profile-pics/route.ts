import { getErrorMessage } from '@/lib/types';

import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { WHATSAPP_CONFIG } from '@/lib/constants';
import { getContactProfilePicture, getStatus } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
    try {
        const status = getStatus();

        if (status.status !== 'ready') {
            return NextResponse.json({
                error: 'WhatsApp not connected',
                status: status.status
            }, { status: 400 });
        }

        // Get all contacts with phone numbers
        const result = await pool.query('SELECT cpf, nome, telefone FROM leads WHERE telefone IS NOT NULL');
        const contacts = result.rows;

        console.log(`[Sync Profile Pics] Starting sync for ${contacts.length} contacts...`);

        let successCount = 0;
        let failCount = 0;
        const results: any[] = [];

        for (const contact of contacts) {
            try {
                console.log(`[Sync Profile Pics] Processing ${contact.nome} (${contact.telefone})...`);

                const profilePicUrl = await getContactProfilePicture(contact.telefone);

                if (profilePicUrl) {
                    await pool.query('UPDATE leads SET profile_image = $1 WHERE cpf = $2', [profilePicUrl, contact.cpf]);
                    successCount++;
                    results.push({ cpf: contact.cpf, nome: contact.nome, status: 'success', profilePicUrl });
                    console.log(`[Sync Profile Pics] ✓ Updated ${contact.nome}`);
                } else {
                    failCount++;
                    results.push({ cpf: contact.cpf, nome: contact.nome, status: 'no_picture' });
                    console.log(`[Sync Profile Pics] ⚠️ No picture for ${contact.nome}`);
                }

                await new Promise(resolve => setTimeout(resolve, WHATSAPP_CONFIG.PROFILE_SYNC_DELAY_MS));

            } catch (error: unknown) {
                failCount++;
                results.push({ cpf: contact.cpf, nome: contact.nome, status: 'error', message: getErrorMessage(error) });
                console.error(`[Sync Profile Pics] Error for ${contact.nome}:`, error);
            }
        }

        console.log(`[Sync Profile Pics] Completed: ${successCount} success, ${failCount} failed/no picture`);

        return NextResponse.json({ success: true, total: contacts.length, successCount, failCount, results });

    } catch (error: unknown) {
        console.error('[Sync Profile Pics] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', message: getErrorMessage(error) }, { status: 500 });
    }
}
