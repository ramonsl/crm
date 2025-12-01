import { NextResponse } from 'next/server';
import { getContactProfilePicture } from '@/lib/whatsapp';
import db from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { phone, cpf } = await req.json();

        if (!phone || !cpf) {
            return NextResponse.json({ error: 'Phone and CPF are required' }, { status: 400 });
        }

        const profilePicUrl = await getContactProfilePicture(phone);

        if (profilePicUrl) {
            // Update database
            const stmt = db.prepare('UPDATE leads SET profile_image = ? WHERE cpf = ?');
            stmt.run(profilePicUrl, cpf);

            return NextResponse.json({ success: true, profile_image: profilePicUrl });
        }

        return NextResponse.json({ success: false, message: 'No profile picture found' });

    } catch (error: any) {
        console.error('Error syncing profile pic:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
