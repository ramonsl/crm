/**
 * LinkedInJobAutomationService
 * 
 * Responsibility: Orchestrate the full job automation flow.
 * Sources: LinkedIn profiles + Remotar.com.br API + VagasRemotas.com.br HTML
 * 1. Fetch settings
 * 2. Scrape profiles (LinkedIn) and API (Remotar)
 * 3. Filter duplicates
 * 4. Transform via AI (LinkedIn only — Remotar data is already structured)
 * 5. Send to WhatsApp Group
 * 6. Record metrics
 */

import { linkedInScraperService } from './LinkedInScraperService';
import { remotarScraperService } from './RemotarScraperService';
import { vagasRemotasScraperService } from './VagasRemotasScraperService';
import { jobTransformerService } from './JobTransformerService';
import { LinkedInJobRepository } from '@/lib/repositories/LinkedInJobRepository';
import { SettingRepository } from '@/lib/repositories/SettingRepository';
import { whatsAppGroupService } from './whatsAppGroupService';
import { workeiScraperService } from './scrapers/WorkeiScraperService';
import { dbLogger } from '@/lib/logger';

export class LinkedInJobAutomationService {
    private jobRepo: LinkedInJobRepository;
    private settingRepo: SettingRepository;

    constructor() {
        this.jobRepo = new LinkedInJobRepository();
        this.settingRepo = new SettingRepository();
    }

    /**
     * Run the full sync process (LinkedIn + Remotar + VagasRemotas)
     */
    async runSync(): Promise<{ processed: number; posted: number; skipped: number; errors: number }> {
        dbLogger.info('[JobAutomation] Starting sync...');

        const stats = { processed: 0, posted: 0, skipped: 0, errors: 0 };
        const groupId = await this.settingRepo.get('linkedin_group_id');

        if (!groupId) {
            dbLogger.warn('[JobAutomation] Missing WhatsApp group_id setting');
            return stats;
        }

        // Run all sources
        const linkedInStats = await this.syncLinkedIn(groupId);
        const remotarStats = await this.syncRemotar(groupId);
        const vagasRemotasStats = await this.syncVagasRemotas(groupId);
        const workeiStats = await this.syncWorkei(groupId);

        // Merge stats
        stats.processed = linkedInStats.processed + remotarStats.processed + vagasRemotasStats.processed + workeiStats.processed;
        stats.posted = linkedInStats.posted + remotarStats.posted + vagasRemotasStats.posted + workeiStats.posted;
        stats.skipped = linkedInStats.skipped + remotarStats.skipped + vagasRemotasStats.skipped + workeiStats.skipped;
        stats.errors = linkedInStats.errors + remotarStats.errors + vagasRemotasStats.errors + workeiStats.errors;

        dbLogger.info(`[JobAutomation] Sync complete: ${JSON.stringify(stats)}`);
        return stats;
    }

    /**
     * Sync jobs from LinkedIn profiles
     */
    private async syncLinkedIn(groupId: string): Promise<{ processed: number; posted: number; skipped: number; errors: number }> {
        const stats = { processed: 0, posted: 0, skipped: 0, errors: 0 };

        try {
            const token = await this.settingRepo.get('linkedin_access_token');
            const profilesStr = await this.settingRepo.get('linkedin_profiles');

            if (!token || !profilesStr) {
                dbLogger.info('[JobAutomation] LinkedIn: Skipping (no token or profiles configured)');
                return stats;
            }

            const profiles = profilesStr.split(',').map(p => p.trim()).filter(p => p !== '');
            const recentJobs = [];

            for (const profileId of profiles) {
                const posts = await linkedInScraperService.fetchProfilePosts(profileId, token);
                const recentPosts = linkedInScraperService.filterRecentPosts(posts);
                recentJobs.push(...recentPosts);
            }

            stats.processed = recentJobs.length;
            dbLogger.info(`[JobAutomation] LinkedIn: ${recentJobs.length} posts from ${profiles.length} profiles`);

            for (const post of recentJobs) {
                try {
                    if (await this.jobRepo.exists(post.id)) {
                        stats.skipped++;
                        continue;
                    }

                    const parsed = await jobTransformerService.transformPost(post.text, post.id, post.url);

                    if (!parsed || !parsed.isJob || !parsed.isRemote) {
                        await this.jobRepo.create({
                            linkedin_post_id: post.id,
                            title: parsed?.title || 'Não aplicável',
                            company: parsed?.company || 'Não aplicável',
                            location: parsed?.location || null,
                            is_remote: parsed?.isRemote || false,
                            raw_content: post.text,
                            formatted_message: null,
                            url: post.url,
                            posted_at: post.postedAt,
                            status: 'rejected',
                            error_message: parsed?.isJob ? 'Not remote' : 'Not a job post'
                        });
                        stats.skipped++;
                        continue;
                    }

                    const message = jobTransformerService.formatWhatsAppMessage(parsed);
                    await whatsAppGroupService.sendToGroupById(groupId, message);

                    await this.jobRepo.create({
                        linkedin_post_id: post.id,
                        title: parsed.title,
                        company: parsed.company,
                        location: parsed.location,
                        is_remote: parsed.isRemote,
                        raw_content: post.text,
                        formatted_message: message,
                        url: post.url,
                        posted_at: post.postedAt,
                        status: 'posted',
                        error_message: null
                    });

                    stats.posted++;
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (error) {
                    dbLogger.error(`[JobAutomation] LinkedIn error on post ${post.id}:`, error);
                    stats.errors++;
                }
            }
        } catch (error) {
            dbLogger.error('[JobAutomation] LinkedIn sync failed:', error);
        }

        return stats;
    }

    /**
     * Sync jobs from Remotar.com.br API
     */
    private async syncRemotar(groupId: string): Promise<{ processed: number; posted: number; skipped: number; errors: number }> {
        const stats = { processed: 0, posted: 0, skipped: 0, errors: 0 };

        try {
            const remotarEnabled = await this.settingRepo.get('remotar_enabled');
            if (remotarEnabled !== 'true') {
                dbLogger.info('[JobAutomation] Remotar: Skipping (not enabled)');
                return stats;
            }

            const categories = await this.settingRepo.get('remotar_categories') || '2,3,4,7,10,12,15,13,14,8';
            const filterHoursStr = await this.settingRepo.get('remotar_filter_hours');
            const filterHours = parseInt(filterHoursStr || '48') || 48;

            const allJobs = await remotarScraperService.fetchRecentJobs(categories, 5);
            const recentJobs = remotarScraperService.filterRecentJobs(allJobs, filterHours);

            stats.processed = recentJobs.length;
            dbLogger.info(`[JobAutomation] Remotar: ${allJobs.length} total, ${recentJobs.length} from last ${filterHours}h`);

            for (const job of recentJobs) {
                try {
                    // Use remotar- prefix to avoid collision with LinkedIn post IDs
                    const postId = `remotar-${job.id}`;

                    if (await this.jobRepo.exists(postId)) {
                        stats.skipped++;
                        continue;
                    }

                    const message = remotarScraperService.formatWhatsAppMessage(job);
                    await whatsAppGroupService.sendToGroupById(groupId, message);

                    await this.jobRepo.create({
                        linkedin_post_id: postId,
                        title: job.title,
                        company: job.company,
                        location: job.location,
                        is_remote: true,
                        raw_content: job.description.substring(0, 5000),
                        formatted_message: message,
                        url: job.externalLink || job.url,
                        posted_at: job.createdAt,
                        status: 'posted',
                        error_message: null
                    });

                    stats.posted++;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    dbLogger.error(`[JobAutomation] Remotar error on job ${job.id}:`, error);
                    stats.errors++;
                }
            }
        } catch (error) {
            dbLogger.error('[JobAutomation] Remotar sync failed:', error);
        }

        return stats;
    }

    /**
     * Sync jobs from VagasRemotas.com.br HTML scraping
     */
    private async syncVagasRemotas(groupId: string): Promise<{ processed: number; posted: number; skipped: number; errors: number }> {
        const stats = { processed: 0, posted: 0, skipped: 0, errors: 0 };

        try {
            const vagasRemotasEnabled = await this.settingRepo.get('vagasremotas_enabled');
            if (vagasRemotasEnabled !== 'true') {
                dbLogger.info('[JobAutomation] VagasRemotas: Skipping (not enabled)');
                return stats;
            }

            const filterHoursStr = await this.settingRepo.get('remotar_filter_hours');
            const filterHours = parseInt(filterHoursStr || '48') || 48;

            const allJobs = await vagasRemotasScraperService.fetchJobs();
            const recentJobs = vagasRemotasScraperService.filterRecentJobs(allJobs, filterHours);

            stats.processed = recentJobs.length;
            dbLogger.info(`[JobAutomation] VagasRemotas: ${allJobs.length} total, ${recentJobs.length} from last ${filterHours}h`);

            for (const job of recentJobs) {
                try {
                    const postId = `vagasremotas-${job.id}`;

                    if (await this.jobRepo.exists(postId)) {
                        stats.skipped++;
                        continue;
                    }

                    const message = vagasRemotasScraperService.formatWhatsAppMessage(job);
                    await whatsAppGroupService.sendToGroupById(groupId, message);

                    await this.jobRepo.create({
                        linkedin_post_id: postId,
                        title: job.title,
                        company: job.company,
                        location: '100% Remoto',
                        is_remote: true,
                        raw_content: job.description.substring(0, 5000),
                        formatted_message: message,
                        url: job.url,
                        posted_at: new Date().toISOString(),
                        status: 'posted',
                        error_message: null
                    });

                    stats.posted++;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    dbLogger.error(`[JobAutomation] VagasRemotas error on job ${job.id}:`, error);
                    stats.errors++;
                }
            }
        } catch (error) {
            dbLogger.error('[JobAutomation] VagasRemotas sync failed:', error);
        }

        return stats;
    }

    /**
     * Sync jobs from Workei.com.br REST API
     */
    private async syncWorkei(groupId: string): Promise<{ processed: number; posted: number; skipped: number; errors: number }> {
        const stats = { processed: 0, posted: 0, skipped: 0, errors: 0 };

        try {
            const workeiEnabled = await this.settingRepo.get('workei_enabled');
            if (workeiEnabled !== 'true') {
                dbLogger.info('[JobAutomation] Workei: Skipping (not enabled)');
                return stats;
            }

            const filterHoursStr = await this.settingRepo.get('workei_filter_hours') || await this.settingRepo.get('remotar_filter_hours');
            const filterHours = parseInt(filterHoursStr || '48') || 48;

            const allJobs = await workeiScraperService.fetchRecentJobs(10);
            const recentJobs = workeiScraperService.filterRecentJobs(allJobs, filterHours);

            stats.processed = recentJobs.length;
            dbLogger.info(`[JobAutomation] Workei: ${allJobs.length} total, ${recentJobs.length} from last ${filterHours}h`);

            for (const job of recentJobs) {
                try {
                    const postId = `workei-${job.id}`;

                    if (await this.jobRepo.exists(postId)) {
                        stats.skipped++;
                        continue;
                    }

                    const message = workeiScraperService.formatWhatsAppMessage(job);
                    await whatsAppGroupService.sendToGroupById(groupId, message);

                    await this.jobRepo.create({
                        linkedin_post_id: postId,
                        title: job.title,
                        company: job.company,
                        location: job.location, // usually "Remoto"
                        is_remote: true,
                        raw_content: job.description.substring(0, 5000),
                        formatted_message: message,
                        url: job.url,
                        posted_at: job.createdAt.toISOString(),
                        status: 'posted',
                        error_message: null
                    });

                    stats.posted++;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    dbLogger.error(`[JobAutomation] Workei error on job ${job.id}:`, error);
                    stats.errors++;
                }
            }
        } catch (error) {
            dbLogger.error('[JobAutomation] Workei sync failed:', error);
        }

        return stats;
    }
}

export const linkedInJobAutomationService = new LinkedInJobAutomationService();
