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
    private openai: OpenAI | null = null;

    constructor() {
        // Inicialização lazy: o cliente OpenAI é criado apenas na primeira chamada
        // para evitar falhas durante o build do Next.js (SSG sem env vars disponíveis)
    }

    private getOpenAIClient(): OpenAI {
        if (!this.openai) {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error('OPENAI_API_KEY not configured');
            }
            this.openai = new OpenAI({ apiKey });
        }
        return this.openai;
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

            const completion = await this.getOpenAIClient().chat.completions.create({
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

    /** Rodapé institucional anexado a todas as vagas postadas */
    private static readonly JOB_FOOTER = `
---
📚 *Serviço do Curso de Análise e Desenvolvimento de Sistemas*
🏫 *ULBRA Torres* — 80% de empregabilidade dos formandos!
📲 *Mais informações:* +55 51 2160-1994`;

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
${job.applicationLink}${JobTransformerService.JOB_FOOTER}`;
    }

    /**
     * Extract and rewrite multiple job vacancies from a single forwarded text (e.g. job list from Telegram/WhatsApp groups).
     * Removes propaganda, group links and consultancy noise, returning each job individually formatted.
     *
     * @param text Raw text containing one or more job listings
     * @returns Array of individually formatted jobs, or empty array if none found
     */
    async extractJobList(text: string): Promise<Array<{ title: string; formattedMessage: string; applicationLink: string | null }>> {
        const prompt = `Você é um assistente especializado em vagas de emprego remotas para o mercado brasileiro de tecnologia.

O texto abaixo foi encaminhado de um grupo e contém MÚLTIPLAS vagas de emprego:

"""
${text.substring(0, 6000)}
"""

Sua tarefa:
1. Identifique CADA vaga individualmente no texto.
2. Para cada vaga, IGNORE e REMOVA completamente:
   - Propaganda de grupos/canais ("entre no nosso grupo", "acesse nosso Telegram", etc.)
   - Links de grupos de WhatsApp ou Telegram
   - Assinaturas de bots, canais ou consultoras
   - Avisos de curadoria ou disclaimers
   - Qualquer conteúdo que não seja a vaga em si
3. Para cada vaga extraída:
   - Reescreva de forma atrativa e profissional em português brasileiro
   - Use emojis moderadamente
   - Inclua: cargo, empresa (se informada), modalidade (remoto/presencial/híbrido), tecnologias/requisitos principais e link de candidatura
   - Ao final de cada formattedMessage, adicione SEMPRE este rodapé exatamente como está:

---
📚 *Serviço do Curso de Análise e Desenvolvimento de Sistemas*
🏫 *ULBRA Torres* — 80% de empregabilidade dos formandos!
📲 *Mais informações:* +55 51 2160-1994

Responda APENAS com JSON no formato:
{
  "jobs": [
    {
      "title": "título/cargo da vaga",
      "formattedMessage": "mensagem formatada para WhatsApp",
      "applicationLink": "URL ou email de candidatura ou null"
    }
  ]
}

Se não encontrar nenhuma vaga válida, retorne { "jobs": [] }.`;

        try {
            const completion = await this.getOpenAIClient().chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) return [];

            const data = JSON.parse(content);
            if (!Array.isArray(data.jobs)) return [];

            return data.jobs
                .filter((j: { title?: string; formattedMessage?: string }) => j.title && j.formattedMessage)
                .map((j: { title: string; formattedMessage: string; applicationLink?: string | null }) => ({
                    title: j.title,
                    formattedMessage: j.formattedMessage,
                    applicationLink: j.applicationLink ?? null,
                }));
        } catch (error) {
            dbLogger.error('[JobTransformer] Erro ao extrair lista de vagas:', error);
            return [];
        }
    }

    /**
     * Rewrite a forwarded job description text into an attractive, clean WhatsApp message.
     * Removes group/consultancy propaganda and formats content professionally.
     *
     * @param text Raw text forwarded by the user (description from groups/chats)
     * @returns Formatted message ready to post, or null if content is not a job
     */
    async rewriteForwardedJobText(text: string): Promise<{ isJob: boolean; formattedMessage: string | null; applicationLink: string | null }> {
        const prompt = `Você é um assistente especializado em vagas de emprego remotas para o mercado brasileiro de tecnologia.

Analise o texto abaixo, que foi encaminhado de um grupo de WhatsApp ou outra fonte:

"""
${text}
"""

Sua tarefa:
1. Determine se este texto descreve uma vaga de emprego legítima (isJob: true/false).
2. Se for uma vaga:
   a. REMOVA completamente: propaganda de grupos, menções a consultoras, frases como "entre no nosso grupo", "acesse nosso canal", links de grupos de WhatsApp/Telegram, assinaturas de bots/canais, qualquer conteúdo que não seja a vaga em si.
   b. EXTRAIA o link de candidatura (URL de inscrição, e-mail, ou número de contato para se candidatar). Se não houver link claro, deixe null.
   c. REESCREVA a descrição da vaga de forma atrativa, clara e profissional em português brasileiro, usando emojis moderadamente.
   d. O texto reescrito deve conter: cargo, empresa (se informada), modalidade (remoto/presencial/híbrido), requisitos principais, e como se candidatar.
   e. Mantenha o tom motivador mas sem exageros.
   f. Ao final do formattedMessage, adicione SEMPRE este rodapé institucional exatamente como está:

---
📚 *Serviço do Curso de Análise e Desenvolvimento de Sistemas*
🏫 *ULBRA Torres* — 80% de empregabilidade dos formandos!
📲 *Mais informações:* +55 51 2160-1994

3. Se NÃO for uma vaga, responda apenas com isJob: false.

Responda APENAS com JSON no formato:
{
  "isJob": boolean,
  "formattedMessage": "texto reescrito e formatado para WhatsApp ou null",
  "applicationLink": "URL ou email de candidatura ou null"
}`;

        try {
            const completion = await this.getOpenAIClient().chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) return { isJob: false, formattedMessage: null, applicationLink: null };

            const data = JSON.parse(content);
            return {
                isJob: !!data.isJob,
                formattedMessage: data.formattedMessage ?? null,
                applicationLink: data.applicationLink ?? null,
            };
        } catch (error) {
            dbLogger.error('[JobTransformer] Erro ao reescrever vaga encaminhada:', error);
            return { isJob: false, formattedMessage: null, applicationLink: null };
        }
    }
}

export const jobTransformerService = new JobTransformerService();
