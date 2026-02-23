/**
 * JobTransformerService
 * 
 * Responsibility: Transform raw LinkedIn posts into structured job data and professional WhatsApp messages.
 * Uses OpenAI GPT-4o-mini for validation and rewriting.
 */

import OpenAI from 'openai';
import { dbLogger } from '@/lib/logger';

export interface ParsedJob {
    post_id: string;
    title: string;
    company: string;
    location: string;
    isRemote: boolean;
    requirements: string[];
    applicationLink: string;
    isJob: boolean;
}

export class JobTransformerService {
    private openai: OpenAI;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            dbLogger.error('[JobTransformer] OPENAI_API_KEY not configured');
            throw new Error('OPENAI_API_KEY not configured');
        }
        this.openai = new OpenAI({ apiKey });
    }

    /**
     * Use OpenAI to analyze a post and extract structured job data
     */
    async transformPost(text: string, postId: string, url: string): Promise<ParsedJob | null> {
        dbLogger.info(`[JobTransformer] Transforming post ${postId}`);

        try {
            const prompt = `Analise o seguinte post do LinkedIn e extraia informações de vaga de emprego.

Texto do Post:
"${text.substring(0, 3000)}"

Retorne um JSON com os seguintes campos:
- isJob: booleano (true se for REALMENTE uma vaga de emprego, false se for apenas notícia, artigo ou opinião)
- title: cargo da vaga (string)
- company: nome da empresa (string)
- location: localidade (string)
- isRemote: booleano (true apenas se for 100% Home Office/Remoto)
- requirements: array de strings (4 a 6 requisitos técnicos ou comportamentais fundamentais)
- applicationLink: string (extraia o link de inscrição, e-mail ou número de whatsapp para candidatura mencionado no texto)

REGRAS:
1. Se não encontrar um link ou forma de candidatura clara, marque isJob como false.
2. Seja rigoroso sobre isRemote.
3. Se isJob for false, os outros campos podem ser vazios.

Retorne APENAS o JSON, sem markdown.`;

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) return null;

            const data = JSON.parse(content);

            return {
                post_id: postId,
                title: data.title || 'Vaga sem título',
                company: data.company || 'Empresa não informada',
                location: data.location || 'Não informado',
                isRemote: !!data.isRemote,
                requirements: data.requirements || [],
                applicationLink: data.applicationLink || url,
                isJob: !!data.isJob
            };
        } catch (error) {
            dbLogger.error(`[JobTransformer] Error transforming post ${postId}:`, error);
            return null;
        }
    }

    /**
     * Format a parsed job into a professional WhatsApp message
     */
    formatWhatsAppMessage(job: ParsedJob): string {
        const requirementsList = job.requirements.length > 0
            ? job.requirements.map(req => `• ${req}`).join('\n')
            : '• Verifique os pré-requisitos no link de inscrição.';

        return `🚀 *NOVA OPORTUNIDADE REMOTA!*

💼 *Cargo:* ${job.title}
🏢 *Empresa:* ${job.company}
📍 *Local:* ${job.location}${job.isRemote ? ' (100% Remoto)' : ''}

📋 *Principais Requisitos:*
${requirementsList}

🔗 *Como se candidatar:*
${job.applicationLink}

---
_Postado automaticamente via CRM Educacional_`;
    }
}

export const jobTransformerService = new JobTransformerService();
