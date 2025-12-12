/**
 * API Route - Generate AI Message
 * POST /api/ai/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

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

export async function POST(req: NextRequest) {
    try {
        const { prompt, contactName } = await req.json();

        if (!prompt || !contactName) {
            return NextResponse.json(
                { error: 'prompt e contactName são obrigatórios' },
                { status: 400 }
            );
        }

        // Get OpenAI API Key from settings
        const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['openai_api_key']);
        const apiKey = result.rows[0]?.value;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'OpenAI API Key não configurada. Configure em Settings.' },
                { status: 400 }
            );
        }

        // Substitute variables in prompt
        const firstName = contactName.trim().split(' ')[0];
        const finalPrompt = prompt
            .replace(/{nome_completo}/g, contactName)
            .replace(/{nome}/g, firstName);

        console.log(`[AI API] Generating message for ${contactName}...`);

        // Call OpenAI API
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
                        content: 'Você é um assistente útil e amigável da coordenação do curso de ADS da ULBRA.'
                    },
                    { role: 'user', content: finalPrompt }
                ]
            })
        });

        const data = await response.json() as OpenAIResponse;

        if (!response.ok) {
            return NextResponse.json(
                { error: `OpenAI Error: ${data.error?.message || 'Erro desconhecido'}` },
                { status: 500 }
            );
        }

        const generatedMessage = data.choices?.[0]?.message?.content;
        if (!generatedMessage) {
            return NextResponse.json(
                { error: 'OpenAI retornou resposta vazia' },
                { status: 500 }
            );
        }

        console.log(`[AI API] Message generated successfully`);

        return NextResponse.json({
            message: generatedMessage
        });

    } catch (error: any) {
        console.error('[AI API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Erro ao gerar mensagem' },
            { status: 500 }
        );
    }
}
