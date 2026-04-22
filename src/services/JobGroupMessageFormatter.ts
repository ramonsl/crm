/**
 * JobGroupMessageFormatter
 *
 * Responsibility: format grouped job listings and daily summary into WhatsApp messages.
 * Pure functions — no side effects, no external dependencies.
 */

import { SeniorityLevel, SENIORITY_LABELS } from './SeniorityClassifier';

export interface GroupedJobItem {
    title: string;
    company: string;
    location: string;
    url: string;
    description: string;
}

/** Institutional footer appended to every grouped message */
const FOOTER = `\n---\n📚 *Serviço do Curso de Análise e Desenvolvimento de Sistemas*\n🏫 *ULBRA Torres* — 80% de empregabilidade dos formandos!\n📲 *Mais informações:* +55 51 2160-1994`;

function stripHtml(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Format all jobs of a given seniority level into a single consolidated message.
 * Each job appears as a numbered item with brief description + link.
 *
 * WhatsApp has a ~65 535-char limit per message; we truncate if needed.
 */
export function formatGroupByLevel(
    level: SeniorityLevel,
    jobs: GroupedJobItem[],
): string {
    const label = SENIORITY_LABELS[level];
    const header = `📋 *VAGAS REMOTAS — ${label.toUpperCase()} (${jobs.length} ${jobs.length === 1 ? 'oportunidade' : 'oportunidades'})*\n`;

    const items = jobs.map((job, index) => {
        const num = `${index + 1}️⃣`;
        const descSnippet = stripHtml(job.description)
            .replace(/\n+/g, ' ')
            .substring(0, 120)
            .trim();
        const desc = descSnippet.length >= 120 ? descSnippet + '...' : descSnippet;

        return `${num} *${job.title}*\n🏢 ${job.company} | 📍 ${job.location || '100% Remoto'}\n📝 ${desc}\n🔗 ${job.url}`;
    });

    const body = items.join('\n\n');

    // WhatsApp max message size safety
    const full = `${header}\n${body}${FOOTER}`;
    if (full.length > 60000) {
        return full.substring(0, 60000) + '\n\n⚠️ Mensagem truncada. Veja todas as vagas no painel.';
    }

    return full;
}

/**
 * Format the daily summary message with stats per level and a motivational quote.
 */
export function formatDailySummary(
    statsByLevel: Record<SeniorityLevel, number>,
    motivationalQuote: string,
): string {
    const total = Object.values(statsByLevel).reduce((a, b) => a + b, 0);

    const levelSummary = (Object.entries(SENIORITY_LABELS) as [SeniorityLevel, string][])
        .filter(([level]) => statsByLevel[level] > 0)
        .map(([level, label]) => `${label}: ${statsByLevel[level]}`)
        .join(' | ');

    return `📊 *RESUMO DO DIA*\nHoje foram *${total}* novas vagas remotas!\n${levelSummary}\n\n💪 _"${motivationalQuote}"_\n\n📚 *Coordena+ ADS* — ULBRA Torres`;
}
