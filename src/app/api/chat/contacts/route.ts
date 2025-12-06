import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { getActiveChats } from '@/lib/whatsapp';

// GET /api/chat/contacts - Get all contacts prioritizing WhatsApp active chats
export async function GET(req: NextRequest) {
    try {
        console.log('[API] Buscando contatos do chat...');

        // QUICK FIX: Comentar getActiveChats para performance
        // Buscar apenas do banco de dados (RÁPIDO <1s)
        // const whatsappChats = await getActiveChats(); // Demora 30-60s!
        // console.log(`[API] WhatsApp retornou ${whatsappChats.length} conversas`);

        // Buscar leads do DB com última mensagem
        const dbLeads = db.prepare(`
            SELECT 
                l.cpf,
                l.nome,
                l.telefone,
                l.email,
                l.status,
                l.tipo_ingresso,
                l.unread_count,
                l.profile_picture as profile_image,
                m.body as last_message,
                m.timestamp as last_message_time,
                m.direction as last_message_direction
            FROM leads l
            LEFT JOIN (
                SELECT contact_cpf, body, timestamp, direction,
                       ROW_NUMBER() OVER (PARTITION BY contact_cpf ORDER BY timestamp DESC) as rn
                FROM messages
            ) m ON l.cpf = m.contact_cpf AND m.rn = 1
            WHERE l.telefone IS NOT NULL AND l.telefone != ''
            ORDER BY m.timestamp DESC NULLS LAST, l.nome ASC
            LIMIT 100
        `).all() as any[];

        console.log(`[API] Banco de dados retornou ${dbLeads.length} leads`);

        // Formatar contatos
        const contacts = dbLeads.map(lead => ({
            cpf: lead.cpf,
            nome: lead.nome,
            telefone: lead.telefone,
            status: lead.status || 'LEAD',
            tipo_ingresso: lead.tipo_ingresso,
            unread_count: lead.unread_count || 0,
            profile_image: lead.profile_image,
            last_message: lead.last_message,
            last_message_time: lead.last_message_time,
            last_message_direction: lead.last_message_direction,
        }));

        console.log(`[API] ✅ Retornando ${contacts.length} contatos (DB only - RÁPIDO)`);

        return NextResponse.json({ contacts });
    } catch (error) {
        console.error('[API] Error fetching chat contacts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
