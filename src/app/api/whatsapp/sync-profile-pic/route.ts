import { getErrorMessage } from '@/lib/types';

import { NextResponse } from 'next/server';
import { getContactProfilePicture } from '@/lib/whatsapp';
import { pool } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { phone, cpf } = await req.json();

        if (!phone || !cpf) {
            return NextResponse.json({ error: 'Phone and CPF are required' }, { status: 400 });
        }

        const profilePicUrl = await getContactProfilePicture(phone);

        if (profilePicUrl) {
            await pool.query('UPDATE leads SET profile_image = $1 WHERE cpf = $2', [profilePicUrl, cpf]);
            return NextResponse.json({ success: true, profile_image: profilePicUrl });
        }

        return NextResponse.json({ success: false, message: 'No profile picture found' });

    } catch (error: unknown) {
        console.error('Error syncing profile pic:', error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
