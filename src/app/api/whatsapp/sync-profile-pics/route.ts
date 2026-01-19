import { getErrorMessage } from '@/lib/types';

import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { WHATSAPP_CONFIG } from '@/lib/constants';
import { getContactProfilePicture, getStatus } from '@/lib/whatsapp';

/**
 * Execute batch update of profile images using a single query with CASE statement
 * This reduces N individual UPDATEs to 1 query
 */
async function executeBatchUpdate(batch: { cpf: string; profilePicUrl: string }[]) {
    if (batch.length === 0) return;

    // Build CASE statement for batch update
    // UPDATE leads SET profile_image = CASE 
    //   WHEN cpf = '123' THEN 'url1'
    //   WHEN cpf = '456' THEN 'url2'
    // END
    // WHERE cpf IN ('123', '456')

    const cpfs = batch.map(item => item.cpf);
    const caseStatements = batch.map((item, index) =>
        `WHEN cpf = $${index * 2 + 1} THEN $${index * 2 + 2}`
    ).join(' ');

    const params: string[] = [];
    batch.forEach(item => {
        params.push(item.cpf, item.profilePicUrl);
    });
    params.push(...cpfs); // For the WHERE IN clause

    const placeholders = cpfs.map((_, index) => `$${batch.length * 2 + index + 1}`).join(', ');

    const query = `
        UPDATE leads 
        SET profile_image = CASE 
            ${caseStatements}
        END
        WHERE cpf IN (${placeholders})
    `;

    await pool.query(query, params);
}

export async function POST(req: NextRequest) {
    try {
        const status = await getStatus();

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

        // Batch size for updates (process 100 at a time to avoid overwhelming the database)
        const BATCH_SIZE = 100;
        const updateBatch: { cpf: string; profilePicUrl: string }[] = [];

        for (const contact of contacts) {
            try {
                console.log(`[Sync Profile Pics] Processing ${contact.nome} (${contact.telefone})...`);

                const profilePicUrl = await getContactProfilePicture(contact.telefone);

                if (profilePicUrl) {
                    // Add to batch instead of updating immediately
                    updateBatch.push({ cpf: contact.cpf, profilePicUrl });
                    successCount++;
                    results.push({ cpf: contact.cpf, nome: contact.nome, status: 'success', profilePicUrl });
                    console.log(`[Sync Profile Pics] ✓ Queued ${contact.nome}`);

                    // Execute batch update when batch is full
                    if (updateBatch.length >= BATCH_SIZE) {
                        await executeBatchUpdate(updateBatch);
                        console.log(`[Sync Profile Pics] ✓ Batch updated ${updateBatch.length} profiles`);
                        updateBatch.length = 0; // Clear batch
                    }
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

        // Execute remaining batch updates
        if (updateBatch.length > 0) {
            await executeBatchUpdate(updateBatch);
            console.log(`[Sync Profile Pics] ✓ Final batch updated ${updateBatch.length} profiles`);
        }

        console.log(`[Sync Profile Pics] Completed: ${successCount} success, ${failCount} failed/no picture`);

        return NextResponse.json({ success: true, total: contacts.length, successCount, failCount, results });

    } catch (error: unknown) {
        console.error('[Sync Profile Pics] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', message: getErrorMessage(error) }, { status: 500 });
    }
}
