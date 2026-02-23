/**
 * RemotarScraperService
 * 
 * Responsibility: Fetch remote job listings from Remotar.com.br API.
 * The API returns structured data (title, company, description, link)
 * so no AI processing is needed for parsing.
 */

import { dbLogger } from '@/lib/logger';

export interface RemotarJob {
    id: number;
    title: string;
    company: string;
    companyLogo: string | null;
    description: string;
    externalLink: string;
    location: string;
    tags: string[];
    createdAt: string;
    url: string;
}

interface RemotarApiResponse {
    meta: {
        total: number;
        per_page: number;
        current_page: number;
        last_page: number;
        next_page_url: string | null;
    };
    data: RemotarApiJob[];
}

interface RemotarApiJob {
    id: number;
    title: string;
    companyDisplayName: string | null;
    company: {
        name: string;
        companyProfilePicture?: { smallUrl?: string };
    } | null;
    description: string;
    externalLink: string;
    jobTags: { tag: { name: string } }[];
    createdAt: string;
    updatedAt: string;
}

const DEFAULT_CATEGORIES = '2,3,4,7,10,12,15,13,14,8';
const REMOTAR_API_BASE = 'https://api.remotar.com.br';

export class RemotarScraperService {

    /**
     * Fetch jobs from Remotar API with the given category filters.
     * Returns only jobs from the last 24 hours by default.
     */
    async fetchRecentJobs(
        categoryIds: string = DEFAULT_CATEGORIES,
        maxPages: number = 2
    ): Promise<RemotarJob[]> {
        dbLogger.info(`[RemotarScraper] Fetching jobs (categories: ${categoryIds}, maxPages: ${maxPages})`);

        const allJobs: RemotarJob[] = [];

        for (let page = 1; page <= maxPages; page++) {
            try {
                const url = `${REMOTAR_API_BASE}/jobs?search=&categoryId=${categoryIds}&page=${page}`;

                const response = await fetch(url, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'CRM-Educacional/1.0'
                    },
                    signal: AbortSignal.timeout(15000)
                });

                if (!response.ok) {
                    dbLogger.error(`[RemotarScraper] API returned ${response.status} on page ${page}`);
                    break;
                }

                const data = await response.json() as RemotarApiResponse;

                if (!data.data || !Array.isArray(data.data)) {
                    dbLogger.error(`[RemotarScraper] Unexpected response format on page ${page}`);
                    break;
                }

                const jobs = data.data.map(job => this.mapToRemotarJob(job));
                allJobs.push(...jobs);

                dbLogger.info(`[RemotarScraper] Page ${page}: ${jobs.length} jobs (total so far: ${allJobs.length})`);

                // Stop if no more pages
                if (!data.meta.next_page_url || page >= data.meta.last_page) {
                    break;
                }

                // Small delay between pages
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                dbLogger.error(`[RemotarScraper] Error fetching page ${page}:`, error);
                break;
            }
        }

        dbLogger.info(`[RemotarScraper] Total jobs fetched: ${allJobs.length}`);
        return allJobs;
    }

    /**
     * Filter jobs to only those posted in the last N hours
     */
    filterRecentJobs(jobs: RemotarJob[], hoursAgo: number = 48): RemotarJob[] {
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - hoursAgo);

        return jobs.filter(job => {
            const jobDate = new Date(job.createdAt);
            return jobDate >= cutoff;
        });
    }

    /**
     * Format a Remotar job into a WhatsApp message.
     * Structure:
     *   [ESTÁGIO][JUNIOR...] badges
     *   Cargo
     *   Empresa
     *   Local (100% Remoto)
     *   Descrição
     *   Como se candidatar
     *   VIA Coordena+
     */
    formatWhatsAppMessage(job: RemotarJob): string {
        // Build tag badges like [ESTÁGIO][JUNIOR][PcD]
        const badges = this.buildTagBadges(job.tags);
        const badgeLine = badges.length > 0 ? badges.join('') + '\n\n' : '';

        // Clean description
        const descriptionClean = this.stripHtml(job.description)
            .substring(0, 500)
            .trim();
        const descriptionPreview = descriptionClean.length >= 500
            ? descriptionClean + '...'
            : descriptionClean;

        const applyLink = job.externalLink || job.url;

        return `${badgeLine}💼 *${job.title}*
🏢 ${job.company}
📍 100% Remoto

${descriptionPreview}

🔗 *Como se candidatar:*
${applyLink}

_VIA Coordena+ do Curso de Análise e Desenvolvimento de Sistemas da ULBRA TORRES_`;
    }

    /**
     * Build [TAG] badges from job tags.
     * Maps known tags to short, uppercase labels.
     */
    private buildTagBadges(tags: string[]): string[] {
        const badges: string[] = [];

        const tagMap: { match: string; label: string }[] = [
            { match: 'Estágio', label: '🐣 ESTÁGIO' },
            { match: 'Júnior', label: '🟢 JÚNIOR' },
            { match: 'PcD', label: '♿ PcD' },
            { match: 'Vaga internacional', label: '✈️ INTERNACIONAL' },
            { match: 'Para mulheres', label: '👩🏻 PARA MULHERES' },
            { match: 'LGBTQIAP+', label: '🌈 LGBTQIAP+' },
            { match: 'Jovem Aprendiz', label: '👨🏼‍🎓 JOVEM APRENDIZ' },
            { match: 'Freelancer', label: '💻 FREELANCER' },
            { match: 'Banco de Talentos', label: '🌟 BANCO DE TALENTOS' },
            { match: 'Para pessoas não brancas', label: '🤝 DIVERSIDADE' },
        ];

        for (const check of tagMap) {
            if (tags.some(t => t.includes(check.match))) {
                badges.push(`[${check.label}]`);
            }
        }

        return badges;
    }

    /**
     * Map API response to internal RemotarJob interface
     */
    private mapToRemotarJob(apiJob: RemotarApiJob): RemotarJob {
        const companyName = apiJob.companyDisplayName || apiJob.company?.name || 'Empresa não informada';
        const companyLogo = apiJob.company?.companyProfilePicture?.smallUrl || null;
        const tags = apiJob.jobTags?.map(t => t.tag?.name).filter(Boolean) || [];

        return {
            id: apiJob.id,
            title: apiJob.title || 'Vaga sem título',
            company: companyName,
            companyLogo,
            description: apiJob.description || '',
            externalLink: apiJob.externalLink || '',
            location: '100% Remoto',
            tags,
            createdAt: apiJob.createdAt,
            url: `https://remotar.com.br/vaga/${apiJob.id}`
        };
    }

    /**
     * Strip HTML tags from a string
     */
    private stripHtml(html: string): string {
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/?[^>]+(>|$)/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
}

export const remotarScraperService = new RemotarScraperService();
