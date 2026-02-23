import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, UnauthorizedError } from '@/lib/auth/requireAuth';

/**
 * POST /api/jobs/test-connection
 * Validates the LinkedIn cookie (li_at) format locally.
 * 
 * IMPORTANT: We do NOT make any request to LinkedIn here because
 * accessing LinkedIn from a different IP/User-Agent invalidates
 * the user's active session. The real validation happens during sync.
 */
export async function POST(req: NextRequest) {
    try {
        await requireAuth(req);

        const { token } = await req.json();

        if (!token || typeof token !== 'string') {
            return NextResponse.json({
                success: false,
                error: 'Insira o valor do cookie li_at.'
            }, { status: 400 });
        }

        const trimmed = token.trim();

        // li_at cookies are typically long base64-like strings
        // They usually start with "AQE" and are 200+ characters long
        if (trimmed.length < 50) {
            return NextResponse.json({
                success: false,
                error: `Token muito curto (${trimmed.length} caracteres). O cookie li_at geralmente tem 200+ caracteres. Verifique se copiou o valor completo.`
            });
        }

        // Check for common copy-paste mistakes
        if (trimmed.includes(' ') && !trimmed.includes('=')) {
            return NextResponse.json({
                success: false,
                error: 'O token parece conter espaços. Copie apenas o valor do cookie, sem o nome "li_at=".'
            });
        }

        // Check if user accidentally copied the cookie name too
        if (trimmed.toLowerCase().startsWith('li_at=')) {
            return NextResponse.json({
                success: false,
                error: 'Remova o prefixo "li_at=" — cole apenas o valor do cookie.'
            });
        }

        // Typical li_at token starts with "AQE" 
        const looksValid = trimmed.length >= 100 && /^[A-Za-z0-9_\-=+/.]+$/.test(trimmed);

        if (!looksValid) {
            return NextResponse.json({
                success: false,
                error: 'O formato do token não parece ser um cookie li_at válido. Verifique se copiou o valor correto da aba Application > Cookies > linkedin.com.'
            });
        }

        return NextResponse.json({
            success: true,
            message: `✅ Formato válido (${trimmed.length} caracteres). A conexão real será testada na próxima sincronização.`
        });

    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('[API /api/jobs/test-connection] Error:', message);

        return NextResponse.json({
            success: false,
            error: `Erro ao validar token: ${message}`
        });
    }
}

