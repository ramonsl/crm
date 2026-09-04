/**
 * VagasRemotasScraperService
 * 
 * Responsibility: Fetch remote job listings from VagasRemotas.com.br via HTML scraping.
 * The site uses WordPress/WorkScout and blocks API/RSS access via ModSecurity,
 * so we parse the HTML directly.
 */

import { dbLogger } from '@/lib/logger';

export interface VagasRemotasJob {
    id: string;
    title: string;
    company: string;
    description: string;
    url: string;
    type: string;       // 'vaga-em-dolar' | 'vaga-nacional'
    categories: string[];
    dateText: string;    // ISO date "YYYY-MM-DD" (from <time datetime>), or relative text as fallback
    tags: string[];      // Derived from type + categories
}

const BASE_URL = 'https://vagasremotas.com.br/vagas-home-office-remoto/';

const CATEGORY_LABELS: Record<string, string> = {
    'programacao': 'Programação',
    'marketing': 'Marketing',
    'design': 'Design',
    'comercial': 'Comercial',
    'suporte': 'Suporte',
    'outros': 'Outros',
    'financeiro': 'Financeiro',
    'rh': 'RH',
    'administrativo': 'Administrativo',
    'data': 'Dados',
    'produto': 'Produto',
    'conteudo': 'Conteúdo',
    'gestao': 'Gestão',
};

const TYPE_LABELS: Record<string, string> = {
    'vaga-em-dolar': '💵 Vaga em Dólar',
    'vaga-nacional': '🇧🇷 Vaga Nacional',
};

export class VagasRemotasScraperService {

    /**
     * Fetch and parse job listings from the VagasRemotas homepage.
     * Returns all jobs found on the page (~10 per load).
     */
    async fetchJobs(): Promise<VagasRemotasJob[]> {
        dbLogger.info('[VagasRemotas] Fetching jobs from vagasremotas.com.br...');

        try {
            const response = await fetch(BASE_URL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'pt-BR,pt;q=0.9',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const jobs = this.parseJobListings(html);

            dbLogger.info(`[VagasRemotas] Parsed ${jobs.length} jobs from HTML`);
            return jobs;
        } catch (error) {
            dbLogger.error('[VagasRemotas] Fetch error:', error);
            throw error;
        }
    }

    /**
     * Parse job listings from the WordPress/WorkScout HTML.
     *
     * Current structure (updated to WorkScout with Elementor):
     *   <ul class="job_listings ...">
     *     <li data-title="..." data-company="..." data-job_id="{ID}" ...>
     *       <a href="JOB_URL" class="left post-{ID} job_listing type-job_listing status-publish
     *                                  job_listing_category-{cat} job_listing_type-{type} ...">
     *         <div class="listing-title">
     *           <h4>Title</h4>
     *           <ul class="listing-icons">
     *             <li>Company Name</li>
     *             <li><time datetime="YYYY-MM-DD">Publicado X dias atrás</time></li>
     *             <div class="listing-desc"><p>Description...</p></div>
     *           </ul>
     *         </div>
     *       </a>
     *     </li>
     *   </ul>
     */
    parseJobListings(html: string): VagasRemotasJob[] {
        const jobs: VagasRemotasJob[] = [];

        // Find all job listing occurrences by their class pattern on the <a> element
        const postPattern = /class="left\s+post-(\d+)\s+job_listing\s+type-job_listing\s+status-publish[^"]*"/g;
        const postMatches: { id: string; index: number; classAttr: string }[] = [];

        let match;
        while ((match = postPattern.exec(html)) !== null) {
            postMatches.push({
                id: match[1],
                index: match.index,
                classAttr: match[0],
            });
        }

        for (let i = 0; i < postMatches.length; i++) {
            const post = postMatches[i];

            // The <a href> and the parent <li data-company> both appear before the class attr
            const contextBefore = html.substring(Math.max(0, post.index - 600), post.index);

            // Extract URL from the <a href> just before this class attr
            const hrefMatches = contextBefore.match(/href="(https:\/\/vagasremotas\.com\.br\/[^"]+)"/g);
            const url = hrefMatches
                ? hrefMatches[hrefMatches.length - 1].replace(/href="|"/g, '')
                : '';

            // Extract categories and type from classes
            const categories = this.extractFromClass(post.classAttr, 'job_listing_category-');
            const typeSlug = this.extractFromClass(post.classAttr, 'job_listing_type-')[0] || 'unknown';

            // Extract content block (from this post to the next, or 2000 chars max)
            const endIndex = i + 1 < postMatches.length
                ? postMatches[i + 1].index
                : post.index + 2000;
            const block = html.substring(post.index, endIndex);

            // Extract title from <h3> or <h4>
            const titleMatch = block.match(/<h[34][^>]*>([\s\S]*?)<\/h[34]>/);
            const rawTitle = titleMatch ? this.stripHtml(titleMatch[1]).trim() : '';
            // Title may include type label appended — keep only first meaningful segment
            const titleParts = rawTitle.split(/\t+|\s{2,}/).map(s => s.trim()).filter(Boolean);
            const title = titleParts[0] || rawTitle;

            // Extract company: prefer data-company attribute on the <li> wrapper (most reliable)
            const dataCompanyMatch = contextBefore.match(/data-company="([^"]*)"/);
            const company = dataCompanyMatch
                ? this.decodeHtmlEntities(dataCompanyMatch[1])
                : this.extractCompany(this.stripHtml(block), title);

            // Extract date from <time datetime="YYYY-MM-DD"> attribute (absolute date, robust
            // against locale changes — the site previously used "Posted X ago" but now uses
            // "Publicado X atrás", so we read the machine-readable datetime attribute instead)
            const timeMatch = block.match(/<time\s+datetime="([^"]+)"/);
            const dateText = timeMatch ? timeMatch[1] : '';

            // Extract description from <div class="listing-desc"> in raw HTML
            const descDivMatch = block.match(/<div class="listing-desc">([\s\S]*?)<\/div>/);
            const description = descDivMatch
                ? this.stripHtml(descDivMatch[1]).replace(/\s+/g, ' ').substring(0, 500).trim()
                : '';

            // Build tags from type and categories
            const tags = this.buildTags(typeSlug, categories);

            if (title) {
                jobs.push({
                    id: post.id,
                    title: this.decodeHtmlEntities(title),
                    company,
                    description: this.decodeHtmlEntities(description),
                    url,
                    type: typeSlug,
                    categories,
                    dateText,
                    tags,
                });
            }
        }

        // Deduplicate by post ID (featured posts may appear twice)
        const seen = new Set<string>();
        return jobs.filter(job => {
            if (seen.has(job.id)) return false;
            seen.add(job.id);
            return true;
        });
    }

    /**
     * Filter jobs by age (relative date text parsing).
     * Since VagasRemotas uses relative dates ("Posted X dias ago"),
     * we parse these to estimate age.
     */
    filterRecentJobs(jobs: VagasRemotasJob[], maxHours: number): VagasRemotasJob[] {
        return jobs.filter(job => {
            const hours = this.parseDateTextToHours(job.dateText);
            return hours <= maxHours;
        });
    }

    /**
     * Format a VagasRemotas job into a WhatsApp message.
     * Follows the same structure as RemotarScraperService.
     */
    formatWhatsAppMessage(job: VagasRemotasJob): string {
        const badges = this.buildBadges(job);
        const badgeLine = badges.length > 0 ? badges.join('') + '\n\n' : '';

        const descriptionPreview = job.description.length >= 500
            ? job.description.substring(0, 500).trim() + '...'
            : job.description;

        const typeLabel = TYPE_LABELS[job.type] || '🌐 Remoto';

        return `${badgeLine}💼 *${job.title}*
🏢 ${job.company}
📍 ${typeLabel}

${descriptionPreview}

🔗 *Como se candidatar:*
${job.url}

_VIA Coordena+ do Curso de Análise e Desenvolvimento de Sistemas da ULBRA TORRES_`;
    }

    /**
     * Build [TAG] badges from job metadata.
     */
    private buildBadges(job: VagasRemotasJob): string[] {
        const badges: string[] = [];

        if (job.type === 'vaga-em-dolar') {
            badges.push('[💵 VAGA EM DÓLAR]');
        }

        const categoryBadges: { cat: string; label: string }[] = [
            { cat: 'programacao', label: '💻 PROGRAMAÇÃO' },
            { cat: 'design', label: '🎨 DESIGN' },
            { cat: 'marketing', label: '📢 MARKETING' },
            { cat: 'comercial', label: '🤝 COMERCIAL' },
            { cat: 'data', label: '📊 DADOS' },
        ];

        for (const cb of categoryBadges) {
            if (job.categories.includes(cb.cat)) {
                badges.push(`[${cb.label}]`);
            }
        }

        return badges;
    }

    /**
     * Extract values from CSS class matching a prefix.
     * e.g., extractFromClass(class, 'job_listing_category-') => ['marketing', 'programacao']
     */
    private extractFromClass(classAttr: string, prefix: string): string[] {
        const regex = new RegExp(`${prefix}([a-z0-9-]+)`, 'g');
        const results: string[] = [];
        let m;
        while ((m = regex.exec(classAttr)) !== null) {
            results.push(m[1]);
        }
        return results;
    }

    /**
     * Extract company name from clean text block (fallback when data-company is absent).
     * Handles both the old "Posted ... ago" and new "Publicado ... atrás" site formats.
     */
    private extractCompany(cleanText: string, title: string): string {
        // After title, there's usually type label, then company name, then the date text
        const titleIdx = cleanText.indexOf(title);
        if (titleIdx < 0) return 'Empresa não informada';

        const afterTitle = cleanText.substring(titleIdx + title.length).trim();
        // Skip type labels
        const withoutType = afterTitle
            .replace(/Vaga\s+(em\s+Dólar|Nacional)/gi, '')
            .trim();

        // Company ends where the date marker begins (both old EN and new PT formats)
        const dateMarkerMatch = /\b(?:Posted|Publicado)\b/i.exec(withoutType);
        if (dateMarkerMatch && dateMarkerMatch.index > 0) {
            return withoutType.substring(0, dateMarkerMatch.index).replace(/\s+/g, ' ').trim()
                || 'Empresa não informada';
        }

        return 'Empresa não informada';
    }

    /**
     * Build tags array from job type and categories.
     */
    private buildTags(type: string, categories: string[]): string[] {
        const tags: string[] = [];

        if (type === 'vaga-em-dolar') tags.push('Vaga em Dólar');
        if (type === 'vaga-nacional') tags.push('Vaga Nacional');

        for (const cat of categories) {
            const label = CATEGORY_LABELS[cat];
            if (label) tags.push(label);
        }

        return tags;
    }

    /**
     * Convert a date value to approximate age in hours.
     *
     * Supports two formats:
     *  - ISO date from <time datetime="YYYY-MM-DD"> (new site format)
     *  - Relative text "Posted 5 dias ago" / "Publicado 2 semanas atrás" (old format)
     *
     * Returns 0 (always include) when the format is unrecognised, so an unexpected
     * site change never silently drops all jobs.
     */
    private parseDateTextToHours(dateText: string): number {
        if (!dateText) return 0; // No date info → include the job

        // ISO date from <time datetime="YYYY-MM-DD"> (current site format)
        if (/^\d{4}-\d{2}-\d{2}/.test(dateText)) {
            const posted = new Date(dateText);
            return (Date.now() - posted.getTime()) / (1000 * 60 * 60);
        }

        // Relative text: "Posted 5 dias ago" or "Publicado 2 semanas atrás"
        const match = dateText.match(/(\d+)\s*(minuto|hora|dia|semana|m[eê]s|ano)/i);
        if (!match) return 0; // Unrecognised format → include

        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        const multipliers: Record<string, number> = {
            'minuto': 1 / 60,
            'hora': 1,
            'dia': 24,
            'semana': 168,
            'mês': 720,
            'mes': 720,
            'ano': 8760,
        };

        return value * (multipliers[unit] || 24);
    }

    /**
     * Remove HTML tags from a string, including unclosed tags at the end.
     */
    private stripHtml(html: string): string {
        return html
            .replace(/<[^>]+>/g, ' ')
            .replace(/<[^>]*$/g, '') // Remove unclosed tags at the end
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Decode common HTML entities.
     */
    private decodeHtmlEntities(text: string): string {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&#8211;/g, '–')
            .replace(/&#8212;/g, '—')
            .replace(/&#8217;/g, "'")
            .replace(/&#8220;/g, '"')
            .replace(/&#8221;/g, '"')
            .replace(/&#8230;/g, '...');
    }
}

export const vagasRemotasScraperService = new VagasRemotasScraperService();
