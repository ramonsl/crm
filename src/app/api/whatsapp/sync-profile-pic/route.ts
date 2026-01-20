import { getErrorMessage } from '@/lib/types';
import { NextResponse } from 'next/server';
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory';
import { pool } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Directory for profile pictures - use /tmp for Railway compatibility
const PROFILE_PICS_DIR = path.join('/tmp', 'profile-pics');

// Ensure directory exists
function ensureDirectoryExists() {
    if (!fs.existsSync(PROFILE_PICS_DIR)) {
        fs.mkdirSync(PROFILE_PICS_DIR, { recursive: true });
    }
}

export async function POST(req: Request) {
    try {
        const { phone, cpf } = await req.json();

        if (!phone || !cpf) {
            return NextResponse.json({ error: 'Phone and CPF are required' }, { status: 400 });
        }

        const provider = await WhatsAppProviderFactory.getProvider();
        const profilePicUrl = await provider.getProfilePicture(phone);

        if (profilePicUrl) {
            // Download the image and save to /tmp to avoid URL expiration
            try {
                ensureDirectoryExists();

                const response = await fetch(profilePicUrl);
                if (!response.ok) {
                    console.warn(`[sync-profile-pic] Failed to download image: ${response.status}`);
                    return NextResponse.json({ success: false, message: 'Failed to download profile picture' });
                }

                const buffer = Buffer.from(await response.arrayBuffer());

                // Determine file extension from content-type
                const contentType = response.headers.get('content-type') || 'image/jpeg';
                const ext = contentType.includes('png') ? 'png' :
                    contentType.includes('webp') ? 'webp' : 'jpg';

                // Generate unique filename using cpf for easy identification
                const cleanCpf = cpf.replace(/\D/g, '');
                const filename = `${cleanCpf}_${randomUUID().slice(0, 8)}.${ext}`;
                const filepath = path.join(PROFILE_PICS_DIR, filename);

                // Write file to /tmp
                fs.writeFileSync(filepath, buffer);

                // Generate API URL that will serve this file
                const apiUrl = `/api/profile-pic/${cleanCpf}`;

                // Update database with API URL and store original filename
                await pool.query(
                    'UPDATE leads SET profile_image = $1 WHERE cpf = $2',
                    [apiUrl, cpf]
                );

                console.log(`[sync-profile-pic] Saved profile pic for ${cpf}: ${filepath}`);
                return NextResponse.json({ success: true, profile_image: apiUrl });

            } catch (downloadError) {
                console.error('[sync-profile-pic] Error downloading image:', downloadError);
                // Fall back to saving the URL directly (it may work temporarily)
                await pool.query('UPDATE leads SET profile_image = $1 WHERE cpf = $2', [profilePicUrl, cpf]);
                return NextResponse.json({ success: true, profile_image: profilePicUrl, cached: false });
            }
        }

        return NextResponse.json({ success: false, message: 'No profile picture found' });

    } catch (error: unknown) {
        console.error('Error syncing profile pic:', error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
