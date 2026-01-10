import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { ActivityRepository } from '@/lib/repositories';
import { ActivityService } from '@/services/activityService';
import { sendMessage, getStatus } from '@/lib/whatsapp';
import { requireAuth, UnauthorizedError } from '@/lib/auth/requireAuth';
import { rateLimit, getClientIdentifier } from '@/lib/rateLimit';

// Initialize services
const activityRepository = new ActivityRepository();
const activityService = new ActivityService(activityRepository);

interface Message {
    body: string;
    from_me: boolean;
    timestamp: string;
}

interface OpenAIResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message?: string;
    };
}

/**
 * Generate conversation summary using OpenAI
 */
async function generateConversationSummary(messages: Message[], leadName: string): Promise<string | null> {
    try {
        // Get OpenAI API Key from settings
        const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['openai_api_key']);
        const apiKey = result.rows[0]?.value;

        if (!apiKey) {
            console.log('[Forward API] OpenAI API Key not configured, skipping summary');
            return null;
        }

        if (messages.length === 0) {
            return null;
        }

        // Format messages for the prompt
        const conversationText = messages
            .map(m => `${!m.from_me ? leadName : 'Coordenação'}: ${m.body}`)
            .join('\n');

        const prompt = `Você é um assistente de CRM da coordenação de ADS da ULBRA.
Analise a conversa abaixo entre a coordenação e o candidato ${leadName}.
Gere um resumo BREVE (máximo 5 linhas) focando em:
- O que o candidato está buscando
- Principais dúvidas ou objeções
- Como o comercial pode ajudar a converter este lead
- Finalizar dizendo que é para o curso presencial e se o candidato resistir me informar para eu novamente agir sobre esse lead

Conversa:
${conversationText}`;

        console.log(`[Forward API] Generating summary for ${leadName}...`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'Você é um assistente útil que resume conversas de forma concisa e objetiva.'
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 300
            })
        });

        const data = await response.json() as OpenAIResponse;

        if (!response.ok || data.error) {
            console.error('[Forward API] OpenAI Error:', data.error?.message);
            return null;
        }

        const summary = data.choices?.[0]?.message?.content;
        console.log(`[Forward API] Summary generated successfully`);
        return summary || null;
    } catch (error) {
        console.error('[Forward API] Error generating summary:', error);
        return null;
    }
}

/**
 * POST /api/forward
 * Forward a lead to commercial team via WhatsApp and log in timeline
 */
export async function POST(req: NextRequest) {
    try {
        // Require authentication
        const user = await requireAuth(req);

        // Rate limit - 5 requests per minute (OpenAI cost protection)
        const identifier = getClientIdentifier(req, user);
        const rateLimitResult = rateLimit(identifier, 5, 60000);

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Limite de encaminhamentos excedido. Aguarde 1 minuto.' },
                { status: 429 }
            );
        }

        const { cpf, comercialPhone, comercialName } = await req.json();

        if (!cpf || !comercialPhone) {
            return NextResponse.json(
                { error: 'CPF and comercialPhone are required' },
                { status: 400 }
            );
        }

        // Get lead data - try by CPF first, then by phone
        let leadResult = await pool.query(
            'SELECT cpf, nome, telefone, status FROM leads WHERE cpf = $1',
            [cpf]
        );
        let lead = leadResult.rows[0];

        if (!lead) {
            // Try searching by phone
            leadResult = await pool.query(
                'SELECT cpf, nome, telefone, status FROM leads WHERE telefone LIKE $1',
                [`%${cpf}%`]
            );
            lead = leadResult.rows[0];
            console.log(`[Forward API] Lead not found by CPF, tried phone search for: ${cpf}`, lead ? 'Found!' : 'Not found');
        }

        if (!lead) {
            return NextResponse.json(
                { error: 'Lead not found' },
                { status: 404 }
            );
        }

        console.log(`[Forward API] Found lead: ${lead.nome} (CPF: ${lead.cpf})`);

        const leadCpf = lead.cpf;

        // Check if WhatsApp is connected
        const waStatus = getStatus();
        if (waStatus.status !== 'ready') {
            const statusMessages: Record<string, string> = {
                'disconnected': 'WhatsApp desconectado. Por favor, conecte-se na página WhatsApp.',
                'initializing': 'WhatsApp está inicializando. Aguarde alguns segundos e tente novamente.',
                'qr': 'WhatsApp aguardando leitura do QR Code. Escaneie o código na página WhatsApp.'
            };
            const errorMessage = statusMessages[waStatus.status] || `WhatsApp não está pronto (${waStatus.status})`;
            return NextResponse.json({
                error: errorMessage,
                whatsappStatus: waStatus.status,
                needsConnection: true
            }, { status: 400 });
        }

        // Get recent messages (last 20)
        const messagesResult = await pool.query(`
            SELECT content as body, from_me, timestamp 
            FROM messages 
            WHERE contact_phone = $1 
            ORDER BY timestamp DESC 
            LIMIT 20
        `, [leadCpf]);
        const messages = messagesResult.rows.reverse() as Message[];

        // Generate conversation summary
        const summary = await generateConversationSummary(messages, lead.nome);

        // Build message
        let message = `📋 *Novo Lead para Comercial*\n\n` +
            `👤 *Nome:* ${lead.nome}\n` +
            `📱 *Telefone:* ${lead.telefone}\n` +
            `📊 *Status:* ${lead.status || 'N/A'}`;

        if (summary) {
            message += `\n\n📝 *Resumo da Conversa:*\n${summary}`;
        }

        // Send via WhatsApp
        await sendMessage(comercialPhone, message);

        // Log the forward in the timeline
        await activityService.logForwarded(leadCpf, comercialName || 'Comercial');

        // Auto-tag with "Comercial"
        try {
            // Get or create "Comercial" tag
            const tagResult = await pool.query(
                `SELECT id FROM tags WHERE name = 'Comercial' AND active = 1`
            );

            let tagId;
            if (tagResult.rows.length === 0) {
                // Create tag if it doesn't exist
                const createResult = await pool.query(
                    `INSERT INTO tags (name, color, description, active)
                     VALUES ('Comercial', '#8b5cf6', 'Lead encaminhado para o time comercial', 1)
                     RETURNING id`
                );
                tagId = createResult.rows[0].id;
                console.log('[Forward API] Created "Comercial" tag');
            } else {
                tagId = tagResult.rows[0].id;
            }

            // Associate tag with lead
            await pool.query(
                `INSERT INTO lead_tags (lead_cpf, tag_id)
                 VALUES ($1, $2)
                 ON CONFLICT (lead_cpf, tag_id) DO NOTHING`,
                [leadCpf, tagId]
            );

            console.log(`[Forward API] Tagged lead ${leadCpf} with "Comercial"`);
        } catch (tagError) {
            console.error('[Forward API] Error tagging lead:', tagError);
            // Don't fail the forward if tagging fails
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('[API /api/forward POST] Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
