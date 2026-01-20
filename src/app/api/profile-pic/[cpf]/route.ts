import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { pool } from '@/lib/db';
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory';
import { randomUUID } from 'crypto';

// Directory for profile pictures - use /tmp for Railway compatibility
const PROFILE_PICS_DIR = path.join('/tmp', 'profile-pics');

interface RouteParams {
    params: Promise<{ cpf: string }>;
}

/**
 * GET /api/profile-pic/[cpf]
 * 
 * Serves profile pictures from /tmp cache.
 * If not in cache, tries to fetch from WhatsApp and cache it.
 * This approach works on Railway's ephemeral filesystem.
 */
export async function GET(req: Request, { params }: RouteParams) {
    try {
        const { cpf } = await params;
        const cleanCpf = cpf.replace(/\D/g, '');

        // Look for cached file
        if (fs.existsSync(PROFILE_PICS_DIR)) {
            const files = fs.readdirSync(PROFILE_PICS_DIR);
            const matchingFile = files.find(f => f.startsWith(cleanCpf + '_'));

            if (matchingFile) {
                const filepath = path.join(PROFILE_PICS_DIR, matchingFile);
                const buffer = fs.readFileSync(filepath);

                // Determine content type from extension
                const ext = path.extname(matchingFile).toLowerCase();
                const contentType = ext === '.png' ? 'image/png' :
                    ext === '.webp' ? 'image/webp' : 'image/jpeg';

                return new NextResponse(buffer, {
                    headers: {
                        'Content-Type': contentType,
                        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
                    }
                });
            }
        }

        // Not in cache - try to fetch from WhatsApp
        const leadResult = await pool.query(
            'SELECT telefone FROM leads WHERE cpf = $1',
            [cpf]
        );

        if (leadResult.rows.length === 0) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        const phone = leadResult.rows[0].telefone;

        try {
            const provider = await WhatsAppProviderFactory.getProvider();
            const profilePicUrl = await provider.getProfilePicture(phone);

            if (profilePicUrl) {
                // Download and cache
                const response = await fetch(profilePicUrl);
                if (response.ok) {
                    const buffer = Buffer.from(await response.arrayBuffer());

                    // Ensure directory exists
                    if (!fs.existsSync(PROFILE_PICS_DIR)) {
                        fs.mkdirSync(PROFILE_PICS_DIR, { recursive: true });
                    }

                    // Determine file extension
                    const contentType = response.headers.get('content-type') || 'image/jpeg';
                    const ext = contentType.includes('png') ? 'png' :
                        contentType.includes('webp') ? 'webp' : 'jpg';

                    // Save to cache
                    const filename = `${cleanCpf}_${randomUUID().slice(0, 8)}.${ext}`;
                    const filepath = path.join(PROFILE_PICS_DIR, filename);
                    fs.writeFileSync(filepath, buffer);

                    console.log(`[profile-pic] Cached on-demand: ${filepath}`);

                    return new NextResponse(buffer, {
                        headers: {
                            'Content-Type': contentType,
                            'Cache-Control': 'public, max-age=86400',
                        }
                    });
                }
            }
        } catch (e) {
            console.warn(`[profile-pic] Could not fetch from WhatsApp for ${cpf}:`, e);
        }

        // Return 404 with placeholder hint
        return NextResponse.json({ error: 'Profile picture not available' }, { status: 404 });

    } catch (error) {
        console.error('[profile-pic] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
