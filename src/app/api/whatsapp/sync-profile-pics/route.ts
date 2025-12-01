import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getContactProfilePicture, getStatus } from '@/lib/whatsapp';

// POST /api/whatsapp/sync-profile-pics - Sync profile pictures for all contacts
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
        const contacts = db.prepare('SELECT cpf, nome, telefone FROM leads WHERE telefone IS NOT NULL').all() as any[];

        console.log(`[Sync Profile Pics] Starting sync for ${contacts.length} contacts...`);

        let successCount = 0;
        let failCount = 0;
        const results: any[] = [];

        // Process contacts one by one (to avoid rate limiting)
        for (const contact of contacts) {
            try {
                console.log(`[Sync Profile Pics] Processing ${contact.nome} (${contact.telefone})...`);

                const profilePicUrl = await getContactProfilePicture(contact.telefone);

                if (profilePicUrl) {
                    // Update database
                    const updateStmt = db.prepare(`
                        UPDATE leads
                        SET profile_image = ?
                        WHERE cpf = ?
                    `);
                    updateStmt.run(profilePicUrl, contact.cpf);

                    successCount++;
                    results.push({
                        cpf: contact.cpf,
                        nome: contact.nome,
                        status: 'success',
                        profilePicUrl
                    });
                    console.log(`[Sync Profile Pics] ✓ Updated ${contact.nome}`);
                } else {
                    failCount++;
                    results.push({
                        cpf: contact.cpf,
                        nome: contact.nome,
                        status: 'no_picture',
                        message: 'No profile picture available or privacy settings block it'
                    });
                    console.log(`[Sync Profile Pics] ⚠️ No picture for ${contact.nome}`);
                }

                // Small delay to avoid rate limiting (100ms between requests)
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error: any) {
                failCount++;
                results.push({
                    cpf: contact.cpf,
                    nome: contact.nome,
                    status: 'error',
                    message: error.message
                });
                console.error(`[Sync Profile Pics] Error for ${contact.nome}:`, error);
            }
        }

        console.log(`[Sync Profile Pics] Completed: ${successCount} success, ${failCount} failed/no picture`);

        return NextResponse.json({
            success: true,
            total: contacts.length,
            successCount,
            failCount,
            results
        });

    } catch (error: any) {
        console.error('[Sync Profile Pics] Error:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            message: error.message
        }, { status: 500 });
    }
}
