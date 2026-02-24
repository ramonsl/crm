import { load } from 'cheerio';
import { dbLogger } from '@/lib/logger';

export interface WorkeiJob {
    id: string;
    title: string;
    description: string;
    url: string;
    applicationLink: string;
    createdAt: Date;
    company: string;
    location: string;
    isRemote: boolean;
}

const API_BASE_URL = 'https://workei.com.br/wp-json/wp/v2/posts';

export class WorkeiScraperService {

    /**
     * Fetch recent jobs from the Workei JSON API.
     */
    async fetchRecentJobs(limit: number = 10): Promise<WorkeiJob[]> {
        dbLogger.info(`[Workei] Fetching top ${limit} jobs from API...`);

        try {
            const response = await fetch(`${API_BASE_URL}?per_page=${limit}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const posts = await response.json() as any[];
            const jobs: WorkeiJob[] = [];

            for (const post of posts) {
                const job = this.parsePostToJob(post);
                if (job) jobs.push(job);
            }

            dbLogger.info(`[Workei] Extracted ${jobs.length} jobs successfully.`);
            return jobs;
        } catch (error) {
            dbLogger.error('[Workei] Fetch error:', error);
            throw error;
        }
    }

    /**
     * Filter recent jobs based on hours ago.
     */
    filterRecentJobs(jobs: WorkeiJob[], hoursAgo: number): WorkeiJob[] {
        const cutoff = Date.now() - (hoursAgo * 60 * 60 * 1000);
        return jobs.filter(job => job.createdAt.getTime() > cutoff);
    }

    /**
     * Parse the WordPress JSON post object into the normalized WorkeiJob format.
     */
    private parsePostToJob(post: any): WorkeiJob | null {
        try {
            const rawTitle = post.title?.rendered || '';
            const rawContent = post.content?.rendered || '';
            const url = post.link || '';
            const createdAt = new Date(post.date);

            // Clean Title and Extract Company (often format is "TITLE: Company Oferece...")
            let title = this.stripHtml(rawTitle).trim();
            let company = 'Workei';

            if (title.includes(':')) {
                const parts = title.split(':');
                title = parts[0].trim();
                const afterColon = parts[1].trim();
                // e.g., "FCamara Oferece Vaga 100% Home Office" -> "FCamara"
                company = afterColon.split(' ')[0] || 'Workei';
            }

            const $ = load(rawContent);
            let applicationLink = '';

            // Find application link (Candidatar-se button)
            $('a').each((_i, el) => {
                const text = $(el).text().toLowerCase();
                const href = $(el).attr('href');
                if (href && (text.includes('candidata') || $(el).hasClass('wp-block-button__link'))) {
                    // Overwrite with most specific if multiple found
                    if (!applicationLink || text.includes('candidatar')) {
                        applicationLink = href;
                    }
                }
            });

            if (!applicationLink) {
                applicationLink = url; // fallback to post URL
            }

            // Extract plain text description, limiting length
            const plainDescription = $.text().replace(/\s+/g, ' ').trim().substring(0, 1500) + '...';

            return {
                id: post.id.toString(),
                title,
                company,
                description: plainDescription,
                url,
                applicationLink,
                createdAt,
                location: 'Remoto',
                isRemote: true
            };
        } catch (error) {
            dbLogger.error(`[Workei] Error parsing post ${post.id}:`, error);
            return null;
        }
    }

    /**
     * Helper: Format job to WhatsApp standard template (same as VagasRemotas)
     */
    formatWhatsAppMessage(job: WorkeiJob): string {
        return `*${job.title.toUpperCase()}*

🏢 *Empresa:* ${job.company}
📍 *Local:* Remoto (Home Office)

📝 *Mais detalhes:*
${job.url}

🔗 *Link para Inscrição:*
${job.applicationLink}

#vagas #homeoffice #vagasremotas

---
*Coordena+ Ads* | Robô automatizado de busca de vagas
`;
    }

    private stripHtml(html: string): string {
        return html.replace(/<[^>]*>?/gm, '');
    }
}

export const workeiScraperService = new WorkeiScraperService();
