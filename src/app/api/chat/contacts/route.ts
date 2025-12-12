import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/chat/contacts - Get all contacts prioritizing WhatsApp active chats
export async function GET(req: NextRequest) {
    try {
        console.log('[API] Buscando contatos do chat...');

        // Helper function to validate phone numbers
        const isValidPhone = (phone: string): boolean => {
            if (!phone || phone.trim() === '') return false;
            const cleaned = phone.replace(/[\s\-\(\)]/g, '');
            if (cleaned.includes('@')) return false;
            if (!/^\d+$/.test(cleaned)) return false;
            if (cleaned.length < 8 || cleaned.length > 15) return false;
            return true;
        };

        // Buscar leads do DB com última mensagem
        const result = await pool.query(`
            SELECT 
                l.cpf,
                l.nome,
                l.telefone,
                l.email,
                l.status,
                l.tipo_ingresso,
                l.unread_count,
                l.profile_image,
                m.content as last_message,
                m.timestamp as last_message_time,
                m.from_me as last_message_from_me
            FROM leads l
            LEFT JOIN LATERAL (
                SELECT content, timestamp, from_me
                FROM messages
                WHERE contact_phone = l.cpf OR contact_phone = l.telefone
                ORDER BY timestamp DESC
                LIMIT 1
            ) m ON true
            WHERE l.telefone IS NOT NULL AND l.telefone != ''
            ORDER BY m.timestamp DESC NULLS LAST, l.nome ASC
            LIMIT 100
        `);

        const dbLeads = result.rows;
        console.log(`[API] Banco de dados retornou ${dbLeads.length} leads`);

        // Formatar contatos e filtrar números inválidos
        const contacts = dbLeads
            .filter(lead => isValidPhone(lead.telefone))
            .map(lead => ({
                cpf: lead.cpf,
                nome: lead.nome,
                telefone: lead.telefone,
                status: lead.status || 'LEAD',
                tipo_ingresso: lead.tipo_ingresso,
                unread_count: lead.unread_count || 0,
                profile_image: lead.profile_image,
                last_message: lead.last_message,
                last_message_time: lead.last_message_time,
                last_message_direction: lead.last_message_from_me ? 'outgoing' : 'incoming',
            }));

        const filteredCount = dbLeads.length - contacts.length;
        if (filteredCount > 0) {
            console.log(`[API] ⚠️ Filtrados ${filteredCount} contatos com números inválidos`);
        }

        console.log(`[API] ✅ Retornando ${contacts.length} contatos válidos`);

        return NextResponse.json({ contacts });
    } catch (error) {
        console.error('[API] Error fetching chat contacts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
