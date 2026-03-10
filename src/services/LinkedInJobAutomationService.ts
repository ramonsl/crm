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

type SyncRunStats = {
    processed: number;
    posted: number;
    errors: number;
    skipped?: number;
};

export class LinkedInJobAutomationService {
    private jobRepo: LinkedInJobRepository;
    private settingRepo: SettingRepository;

    // In-memory state for UI polling
    private _isSyncing: boolean = false;
    private _syncLogs: string[] = [];
    private _lastSyncStats: SyncRunStats | null = null;

    get isSyncing() { return this._isSyncing; }
    get syncLogs() { return this._syncLogs; }
    get lastSyncStats() { return this._lastSyncStats; }

    constructor() {
        this.jobRepo = new LinkedInJobRepository();
        this.settingRepo = new SettingRepository();
    }

    /**
     * Run the full sync process (LinkedIn + Remotar + VagasRemotas + Workei)
     */
    async runSync(onProgress?: (msg: string) => void): Promise<{ processed: number; posted: number; skipped: number; errors: number }> {
        if (this._isSyncing) {
            throw new Error('Uma sincronização já está em andamento.');
        }

        this._isSyncing = true;
        this._syncLogs = [];
        this._lastSyncStats = null;

        const internalOnProgress = (msg: string) => {
            if (onProgress) onProgress(msg);
            this._syncLogs.push(`[${new Date().toISOString()}] ${msg}`);
            // Keep only the last 50 logs to avoid memory leaks
            if (this._syncLogs.length > 50) this._syncLogs.shift();
        };

        dbLogger.info('[JobAutomation] runSync initiated');
        internalOnProgress('Iniciando orquestração global de vagas...');

        const stats = {
            processed: 0,
            skipped: 0,
            posted: 0,
            errors: 0
        };

        try {
            const groupId = await this.settingRepo.get('linkedin_group_id');

            if (!groupId) {
                dbLogger.warn('[JobAutomation] Missing WhatsApp group_id setting');
                internalOnProgress('Missing WhatsApp group_id setting. Cannot proceed.');
                return stats;
            }

            // Run all sources
            await this.syncLinkedIn(groupId, stats, internalOnProgress);
            await this.syncRemotar(groupId, stats, internalOnProgress);
            await this.syncVagasRemotas(groupId, stats, internalOnProgress);
            await this.syncWorkei(groupId, stats, internalOnProgress);

            internalOnProgress('Finalizando sincronização global...');
            this._lastSyncStats = stats;
            return stats;
        } catch (error) {
            dbLogger.error('[JobAutomation] runSync failed:', error);
            const errLog = `Erro crítico na orquestração: ${error instanceof Error ? error.message : 'Unknown'}`;
            internalOnProgress(errLog);
            throw error;
        } finally {
            this._isSyncing = false;
        }
    }

    /**
     * Resend all jobs with 'error' status.
     * Useful when the WhatsApp connection failed but the data was successfully scraped.
     */
    async resendErrors(onProgress?: (msg: string) => void): Promise<{ processed: number; posted: number; errors: number }> {
        if (this._isSyncing) {
            throw new Error('Uma operação de sincronização já está em andamento.');
        }

        this._isSyncing = true;
        this._syncLogs = [];
        this._lastSyncStats = null;

        const internalOnProgress = (msg: string) => {
            if (onProgress) onProgress(msg);
            this._syncLogs.push(`[${new Date().toISOString()}] ${msg}`);
            if (this._syncLogs.length > 50) this._syncLogs.shift();
        };

        dbLogger.info('[JobAutomation] resendErrors initiated');
        internalOnProgress('Iniciando reenvio de vagas com erro...');

        const stats = {
            processed: 0,
            posted: 0,
            errors: 0
        };

        try {
            const groupId = await this.settingRepo.get('linkedin_group_id');

            if (!groupId) {
                dbLogger.warn('[JobAutomation] Missing WhatsApp group_id setting');
                internalOnProgress('Missing WhatsApp group_id setting. Cannot proceed.');
                return stats;
            }

            // Get all jobs with error status (limit to 50 at a time to prevent overload)
            const errorJobs = await this.jobRepo.getByStatus('error', 50);

            if (errorJobs.length === 0) {
                internalOnProgress('Nenhuma vaga com erro encontrada.');
                return stats;
            }

            internalOnProgress(`Encontradas ${errorJobs.length} vagas com erro. Iniciando reenvio...`);
            stats.processed = errorJobs.length;

            for (const job of errorJobs) {
                if (!job.formatted_message) {
                    internalOnProgress(`Pulando vaga ${job.id} - sem mensagem formatada.`);
                    continue;
                }

                try {
                    await whatsAppGroupService.sendToGroupById(groupId, job.formatted_message, {
                        idempotencyKey: `jobs:resend:${job.id}`,
                        idempotencyTtlSeconds: 10 * 60
                    });
                    await this.jobRepo.updateStatus(job.id, 'posted');
                    stats.posted++;

                    const msgStr = `Vaga reenviada: "${job.title}" (${job.company}) com sucesso.`;
                    dbLogger.info(`[JobAutomation] ${msgStr}`);
                    internalOnProgress(msgStr);
                } catch (sendError) {
                    const errMsg = `Erro ao reenviar vaga ${job.id}: ${sendError instanceof Error ? sendError.message : String(sendError)}`;
                    dbLogger.error(`[JobAutomation] ${errMsg}`);
                    internalOnProgress(`[Erro] ${errMsg}`);
                    stats.errors++;
                }

                // Add delay between sends
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            internalOnProgress(`Reenvio finalizado. Processadas: ${stats.processed}, Sucesso: ${stats.posted}, Falhas: ${stats.errors}.`);
            return stats;
        } catch (error) {
            dbLogger.error('[JobAutomation] resendErrors failed:', error);
            const errLog = `Erro crítico no reenvio: ${error instanceof Error ? error.message : 'Unknown'}`;
            internalOnProgress(errLog);
            throw error;
        } finally {
            this._isSyncing = false;
        }
    }

    /**
     * Sync jobs from LinkedIn profiles
     */
    private async syncLinkedIn(groupId: string, stats: { processed: number; posted: number; skipped: number; errors: number }, onProgress?: (msg: string) => void): Promise<void> {
        try {
            const token = await this.settingRepo.get('linkedin_access_token');
            const profilesStr = await this.settingRepo.get('linkedin_profiles');

            if (!token || !profilesStr) {
                dbLogger.info('[JobAutomation] LinkedIn: Skipping (no token or profiles configured)');
                onProgress?.('LinkedIn: Pulando (token ou perfis não configurados)');
                return;
            }

            const profiles = profilesStr.split(',').map(p => p.trim()).filter(p => p !== '');
            const recentJobs = [];

            for (const profileId of profiles) {
                const posts = await linkedInScraperService.fetchProfilePosts(profileId, token);
                const recentPosts = linkedInScraperService.filterRecentPosts(posts);
                recentJobs.push(...recentPosts);
            }

            stats.processed += recentJobs.length;
            const logMsg = `LinkedIn: ${recentJobs.length} posts de ${profiles.length} perfis`;
            dbLogger.info(`[JobAutomation] ${logMsg}`);
            onProgress?.(logMsg);

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

                    const createdJob = await this.jobRepo.create({
                        linkedin_post_id: post.id,
                        title: parsed.title,
                        company: parsed.company,
                        location: parsed.location,
                        is_remote: parsed.isRemote,
                        raw_content: post.text,
                        formatted_message: message,
                        url: post.url,
                        posted_at: post.postedAt,
                        status: 'pending',
                        error_message: null
                    });

                    try {
                        await whatsAppGroupService.sendToGroupById(groupId, message, {
                            idempotencyKey: `jobs:linkedin:${post.id}`,
                            idempotencyTtlSeconds: 24 * 60 * 60
                        });
                        await this.jobRepo.updateStatus(createdJob.id, 'posted');
                        stats.posted++;

                        const msgStr = `LinkedIn: Vaga "${parsed.title}" (${parsed.company}) postada com sucesso.`;
                        dbLogger.info(`[JobAutomation] ${msgStr}`);
                        onProgress?.(msgStr);
                    } catch (sendError) {
                        const errMsg = `LinkedIn WhatsApp send error on post ${post.id}: ${sendError instanceof Error ? sendError.message : String(sendError)}`;
                        dbLogger.error(`[JobAutomation] ${errMsg}`);
                        onProgress?.(`[Erro] ${errMsg}`);

                        await this.jobRepo.updateStatus(createdJob.id, 'error', sendError instanceof Error ? sendError.message : String(sendError));
                        stats.errors++;
                    }

                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (error) {
                    dbLogger.error(`[JobAutomation] LinkedIn generic error on post ${post.id}:`, error);
                    stats.errors++;
                }
            }
        } catch (error) {
            dbLogger.error('[JobAutomation] LinkedIn sync failed:', error);
            onProgress?.(`[Erro Crítico] Falha geral no LinkedIn: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Sync jobs from Remotar.com.br API
     */
    private async syncRemotar(groupId: string, stats: { processed: number; posted: number; skipped: number; errors: number }, onProgress?: (msg: string) => void): Promise<void> {
        try {
            const remotarEnabled = await this.settingRepo.get('remotar_enabled');
            if (remotarEnabled !== 'true') {
                dbLogger.info('[JobAutomation] Remotar: Skipping (not enabled)');
                onProgress?.('Remotar: Pulando (não habilitado)');
                return;
            }

            const categories = await this.settingRepo.get('remotar_categories') || '2,3,4,7,10,12,15,13,14,8';
            const filterHoursStr = await this.settingRepo.get('remotar_filter_hours');
            const filterHours = parseInt(filterHoursStr || '48') || 48;

            const allJobs = await remotarScraperService.fetchRecentJobs(categories, 5);
            const recentJobs = remotarScraperService.filterRecentJobs(allJobs, filterHours);

            stats.processed += recentJobs.length;
            const logMsg = `Remotar: ${allJobs.length} total, ${recentJobs.length} das últimas ${filterHours}h`;
            dbLogger.info(`[JobAutomation] ${logMsg}`);
            onProgress?.(logMsg);

            for (const job of recentJobs) {
                try {
                    // Use remotar- prefix to avoid collision with LinkedIn post IDs
                    const postId = `remotar-${job.id}`;

                    if (await this.jobRepo.exists(postId)) {
                        stats.skipped++;
                        continue;
                    }

                    const message = remotarScraperService.formatWhatsAppMessage(job);

                    const createdJob = await this.jobRepo.create({
                        linkedin_post_id: postId,
                        title: job.title,
                        company: job.company,
                        location: job.location,
                        is_remote: true,
                        raw_content: job.description.substring(0, 5000),
                        formatted_message: message,
                        url: job.externalLink || job.url,
                        posted_at: job.createdAt,
                        status: 'pending',
                        error_message: null
                    });

                    try {
                        await whatsAppGroupService.sendToGroupById(groupId, message, {
                            idempotencyKey: `jobs:remotar:${postId}`,
                            idempotencyTtlSeconds: 24 * 60 * 60
                        });
                        await this.jobRepo.updateStatus(createdJob.id, 'posted');
                        stats.posted++;

                        const msgStr = `Remotar: Vaga "${job.title}" (${job.company}) postada com sucesso.`;
                        dbLogger.info(`[JobAutomation] ${msgStr}`);
                        onProgress?.(msgStr);
                    } catch (sendError) {
                        const errMsg = `Remotar WhatsApp send error on job ${job.id}: ${sendError instanceof Error ? sendError.message : String(sendError)}`;
                        dbLogger.error(`[JobAutomation] ${errMsg}`);
                        onProgress?.(`[Erro] ${errMsg}`);

                        await this.jobRepo.updateStatus(createdJob.id, 'error', sendError instanceof Error ? sendError.message : String(sendError));
                        stats.errors++;
                    }

                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    dbLogger.error(`[JobAutomation] Remotar generic error on job ${job.id}:`, error);
                    stats.errors++;
                }
            }
        } catch (error) {
            dbLogger.error('[JobAutomation] Remotar sync failed:', error);
            onProgress?.(`[Erro Crítico] Falha geral no Remotar: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Sync jobs from VagasRemotas.com.br HTML scraping
     */
    private async syncVagasRemotas(groupId: string, stats: { processed: number; posted: number; skipped: number; errors: number }, onProgress?: (msg: string) => void): Promise<void> {
        try {
            const vagasRemotasEnabled = await this.settingRepo.get('vagasremotas_enabled');
            if (vagasRemotasEnabled !== 'true') {
                dbLogger.info('[JobAutomation] VagasRemotas: Skipping (not enabled)');
                onProgress?.('VagasRemotas: Pulando (não habilitado)');
                return;
            }

            const filterHoursStr = await this.settingRepo.get('remotar_filter_hours');
            const filterHours = parseInt(filterHoursStr || '48') || 48;

            const allJobs = await vagasRemotasScraperService.fetchJobs();
            const recentJobs = vagasRemotasScraperService.filterRecentJobs(allJobs, filterHours);

            stats.processed += recentJobs.length;
            const logMsg = `VagasRemotas: ${allJobs.length} total, ${recentJobs.length} das últimas ${filterHours}h`;
            dbLogger.info(`[JobAutomation] ${logMsg}`);
            onProgress?.(logMsg);

            for (const job of recentJobs) {
                try {
                    const postId = `vagasremotas-${job.id}`;

                    if (await this.jobRepo.exists(postId)) {
                        stats.skipped++;
                        continue;
                    }

                    const message = vagasRemotasScraperService.formatWhatsAppMessage(job);

                    const createdJob = await this.jobRepo.create({
                        linkedin_post_id: postId,
                        title: job.title,
                        company: job.company,
                        location: '100% Remoto',
                        is_remote: true,
                        raw_content: job.description.substring(0, 5000),
                        formatted_message: message,
                        url: job.url,
                        posted_at: new Date().toISOString(),
                        status: 'pending',
                        error_message: null
                    });

                    try {
                        await whatsAppGroupService.sendToGroupById(groupId, message, {
                            idempotencyKey: `jobs:vagasremotas:${postId}`,
                            idempotencyTtlSeconds: 24 * 60 * 60
                        });
                        await this.jobRepo.updateStatus(createdJob.id, 'posted');
                        stats.posted++;

                        const msgStr = `VagasRemotas: Vaga "${job.title}" (${job.company}) postada com sucesso.`;
                        dbLogger.info(`[JobAutomation] ${msgStr}`);
                        onProgress?.(msgStr);
                    } catch (sendError) {
                        const errMsg = `VagasRemotas WhatsApp send error on job ${job.id}: ${sendError instanceof Error ? sendError.message : String(sendError)}`;
                        dbLogger.error(`[JobAutomation] ${errMsg}`);
                        onProgress?.(`[Erro] ${errMsg}`);

                        await this.jobRepo.updateStatus(createdJob.id, 'error', sendError instanceof Error ? sendError.message : String(sendError));
                        stats.errors++;
                    }

                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    dbLogger.error(`[JobAutomation] VagasRemotas generic error on job ${job.id}:`, error);
                    stats.errors++;
                }
            }
        } catch (error) {
            dbLogger.error('[JobAutomation] VagasRemotas sync failed:', error);
            onProgress?.(`[Erro Crítico] Falha geral no VagasRemotas: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Sync jobs from Workei.com.br REST API
     */
    private async syncWorkei(groupId: string, stats: { processed: number; posted: number; skipped: number; errors: number }, onProgress?: (msg: string) => void): Promise<void> {
        try {
            const workeiEnabled = await this.settingRepo.get('workei_enabled');
            if (workeiEnabled !== 'true') {
                dbLogger.info('[JobAutomation] Workei: Skipping (not enabled)');
                onProgress?.('Workei: Pulando (não habilitado)');
                return;
            }

            const filterHoursStr = await this.settingRepo.get('workei_filter_hours') || await this.settingRepo.get('remotar_filter_hours');
            const filterHours = parseInt(filterHoursStr || '48') || 48;

            const allJobs = await workeiScraperService.fetchRecentJobs(10);
            const recentJobs = workeiScraperService.filterRecentJobs(allJobs, filterHours);

            stats.processed += recentJobs.length;
            const logMsg = `Workei: ${allJobs.length} total, ${recentJobs.length} das últimas ${filterHours}h`;
            dbLogger.info(`[JobAutomation] ${logMsg}`);
            onProgress?.(logMsg);

            for (const job of recentJobs) {
                try {
                    const postId = `workei-${job.id}`;

                    if (await this.jobRepo.exists(postId)) {
                        stats.skipped++;
                        continue;
                    }

                    const message = workeiScraperService.formatWhatsAppMessage(job);

                    const createdJob = await this.jobRepo.create({
                        linkedin_post_id: postId,
                        title: job.title,
                        company: job.company,
                        location: job.location, // usually "Remoto"
                        is_remote: true,
                        raw_content: job.description.substring(0, 5000),
                        formatted_message: message,
                        url: job.url,
                        posted_at: job.createdAt.toISOString(),
                        status: 'pending',
                        error_message: null
                    });

                    try {
                        await whatsAppGroupService.sendToGroupById(groupId, message, {
                            idempotencyKey: `jobs:workei:${postId}`,
                            idempotencyTtlSeconds: 24 * 60 * 60
                        });
                        await this.jobRepo.updateStatus(createdJob.id, 'posted');
                        stats.posted++;

                        const msgStr = `Workei: Vaga "${job.title}" (${job.company}) postada com sucesso.`;
                        dbLogger.info(`[JobAutomation] ${msgStr}`);
                        onProgress?.(msgStr);
                    } catch (sendError) {
                        const errMsg = `Workei WhatsApp send error on job ${job.id}: ${sendError instanceof Error ? sendError.message : String(sendError)}`;
                        dbLogger.error(`[JobAutomation] ${errMsg}`);
                        onProgress?.(`[Erro] ${errMsg}`);

                        await this.jobRepo.updateStatus(createdJob.id, 'error', sendError instanceof Error ? sendError.message : String(sendError));
                        stats.errors++;
                    }

                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    dbLogger.error(`[JobAutomation] Workei generic error on job ${job.id}:`, error);
                    stats.errors++;
                }
            }
        } catch (error) {
            dbLogger.error('[JobAutomation] Workei sync failed:', error);
            onProgress?.(`[Erro Crítico] Falha geral no Workei: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

export const linkedInJobAutomationService = new LinkedInJobAutomationService();
