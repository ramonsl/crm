/**
 * JobOrchestrationService
 *
 * Responsibility: Orchestrate the full job automation flow.
 * Sources: LinkedIn profiles + Remotar.com.br API + VagasRemotas.com.br HTML + Workei.com.br
 *
 * Flow (v2 — grouped by seniority):
 * 1. Fetch settings
 * 2. Scrape all sources → classify seniority → save to DB as 'collected'
 * 3. After all sources: group collected jobs by seniority level
 * 4. Format one consolidated message per level
 * 5. Send ≤6 messages (5 levels + 1 daily summary) to the WhatsApp group
 * 6. Mark jobs as 'posted'
 *
 * Replaces: LinkedInJobAutomationService
 */

import { linkedInScraperService } from './LinkedInScraperService';
import { remotarScraperService } from './RemotarScraperService';
import { vagasRemotasScraperService } from './VagasRemotasScraperService';
import { jobTransformerService } from './JobTransformerService';
import { LinkedInJobRepository } from '@/lib/repositories/LinkedInJobRepository';
import { SettingRepository } from '@/lib/repositories/SettingRepository';
import { whatsAppGroupService } from './whatsAppGroupService';
import { workeiScraperService } from './scrapers/WorkeiScraperService';
import { classifySeniority } from './SeniorityClassifier';
import { formatGroupByLevel, formatDailySummary } from './JobGroupMessageFormatter';
import { SyncStateManager } from './SyncStateManager';
import type { ILinkedInJobRepository } from '@/lib/repositories/interfaces';
import type { ISettingRepository } from '@/lib/repositories/interfaces';
import type { SeniorityLevel } from '@/lib/types';
import type { GroupedJobItem } from './JobGroupMessageFormatter';
import { dbLogger } from '@/lib/logger';

export interface SyncResult {
    processed: number;
    posted: number;
    skipped: number;
    errors: number;
}

type CollectStats = Pick<SyncResult, 'processed' | 'skipped' | 'errors'>;

export class JobOrchestrationService {
    readonly state: SyncStateManager;

    constructor(
        private readonly jobRepo: ILinkedInJobRepository = new LinkedInJobRepository(),
        private readonly settingRepo: ISettingRepository = new SettingRepository(),
        stateManager?: SyncStateManager,
    ) {
        this.state = stateManager ?? new SyncStateManager();
    }

    get isSyncing(): boolean {
        return this.state.isSyncing;
    }

    get syncLogs(): string[] {
        return this.state.logs;
    }

    /**
     * Run the full sync process (LinkedIn + Remotar + VagasRemotas + Workei).
     *
     * @param notifyGroupId - Optional group ID to send a "searching..." notice before sync starts.
     * @param targetGroupId - Optional group ID to send jobs to. Overrides linkedin_group_id setting.
     *                        When triggered from WhatsApp, pass msg.from so jobs go to the same group.
     */
    async runSync(notifyGroupId?: string, targetGroupId?: string): Promise<SyncResult> {
        if (this.state.isSyncing) {
            throw new Error('Uma sincronização já está em andamento.');
        }

        this.state.start();

        const log = (msg: string) => this.state.addLog(msg);

        dbLogger.info('[JobOrchestration] runSync initiated');
        log('Iniciando orquestração global de vagas...');

        const stats: SyncResult = { processed: 0, skipped: 0, posted: 0, errors: 0 };

        try {
            // Use targetGroupId if provided (WhatsApp trigger), otherwise fall back to setting
            const groupId = targetGroupId ?? await this.settingRepo.get('linkedin_group_id');

            if (!groupId) {
                dbLogger.warn('[JobOrchestration] Missing WhatsApp group_id setting');
                log('Missing WhatsApp group_id setting. Cannot proceed.');
                return stats;
            }

            dbLogger.info(`[JobOrchestration] Sending jobs to group: ${groupId}`);

            if (notifyGroupId) {
                await whatsAppGroupService.sendToGroupById(
                    notifyGroupId,
                    '🔍 Buscando as vagas de hoje. Aguarde um momento...',
                ).catch(() => undefined); // Non-fatal: don't block sync if notification fails
            }

            // ── Phase 1: Collect from all sources ────────────────────────
            await this.collectLinkedIn(stats, log);
            await this.collectRemotar(stats, log);
            await this.collectVagasRemotas(stats, log);
            await this.collectWorkei(stats, log);

            // ── Phase 2: Group & send ────────────────────────────────────
            await this.sendGroupedMessages(groupId, stats, log);

            log('Finalizando sincronização global...');
            dbLogger.info(`[JobOrchestration] runSync completed: processed=${stats.processed}, posted=${stats.posted}, skipped=${stats.skipped}, errors=${stats.errors}`);
            return stats;
        } catch (error) {
            dbLogger.error('[JobOrchestration] runSync failed:', error);
            const errLog = `Erro crítico na orquestração: ${error instanceof Error ? error.message : 'Unknown'}`;
            log(errLog);
            throw error;
        } finally {
            this.state.finish();
        }
    }

    /**
     * Resend all jobs with 'error' status through the standard grouped pipeline.
     */
    async resendErrors(): Promise<SyncResult> {
        if (this.state.isSyncing) {
            throw new Error('Uma operação de sincronização já está em andamento.');
        }

        this.state.start();
        const log = (msg: string) => this.state.addLog(msg);

        dbLogger.info('[JobOrchestration] resendErrors initiated');
        log('Iniciando reenvio de vagas com erro...');

        const stats: SyncResult = { processed: 0, skipped: 0, posted: 0, errors: 0 };

        try {
            const groupId = await this.settingRepo.get('linkedin_group_id');

            if (!groupId) {
                dbLogger.warn('[JobOrchestration] Missing WhatsApp group_id setting');
                log('Missing WhatsApp group_id setting. Cannot proceed.');
                return stats;
            }

            const errorJobs = await this.jobRepo.getByStatus('error', 50);

            if (errorJobs.length === 0) {
                log('Nenhuma vaga com erro encontrada.');
                return stats;
            }

            log(`Encontradas ${errorJobs.length} vagas com erro. Reagendando para reenvio...`);

            // Mark all error jobs as 'collected' so they go through the standard grouped pipeline
            const ids = errorJobs.map(j => j.id);
            await this.jobRepo.bulkUpdateStatus(ids, 'collected', undefined);
            stats.processed = ids.length;

            log('Vagas reagendadas. Executando envio agrupado...');

            // Reuse the standard grouped send pipeline
            await this.sendGroupedMessages(groupId, stats, log);

            log(`Reenvio finalizado. Processadas: ${stats.processed}, Enviadas: ${stats.posted}, Falhas: ${stats.errors}.`);
            return stats;
        } catch (error) {
            dbLogger.error('[JobOrchestration] resendErrors failed:', error);
            throw error;
        } finally {
            this.state.finish();
        }
    }

    // ========================================================================
    // PHASE 1 — COLLECT (scrape → classify → save as 'collected')
    // ========================================================================

    private async collectLinkedIn(stats: CollectStats, log: (msg: string) => void): Promise<void> {
        try {
            const token = await this.settingRepo.get('linkedin_access_token');
            const profilesStr = await this.settingRepo.get('linkedin_profiles');

            if (!token || !profilesStr) {
                log('LinkedIn: Pulando (token ou perfis não configurados)');
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
            log(`LinkedIn: ${recentJobs.length} posts de ${profiles.length} perfis`);

            for (const post of recentJobs) {
                try {
                    if (await this.jobRepo.exists(post.id)) { stats.skipped++; continue; }

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
                            error_message: parsed?.isJob ? 'Not remote' : 'Not a job post',
                            seniority_level: 'outros',
                        });
                        stats.skipped++;
                        continue;
                    }

                    const seniority = classifySeniority(parsed.title, [], post.text);

                    await this.jobRepo.create({
                        linkedin_post_id: post.id,
                        title: parsed.title,
                        company: parsed.company,
                        location: parsed.location,
                        is_remote: parsed.isRemote,
                        raw_content: post.text,
                        formatted_message: jobTransformerService.formatWhatsAppMessage(parsed),
                        url: post.url,
                        posted_at: post.postedAt,
                        status: 'collected',
                        error_message: null,
                        seniority_level: seniority,
                    });

                    log(`LinkedIn: Coletada "${parsed.title}" (${parsed.company}) [${seniority}]`);
                } catch (error) {
                    dbLogger.error(`[JobOrchestration] LinkedIn error on post ${post.id}:`, error);
                    stats.errors++;
                }
            }
        } catch (error) {
            dbLogger.error('[JobOrchestration] LinkedIn collect failed:', error);
            log(`[Erro Crítico] Falha geral no LinkedIn: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async collectRemotar(stats: CollectStats, log: (msg: string) => void): Promise<void> {
        try {
            const remotarEnabled = await this.settingRepo.get('remotar_enabled');
            if (remotarEnabled !== 'true') { log('Remotar: Pulando (não habilitado)'); return; }

            const categories = await this.settingRepo.get('remotar_categories') || '2,3,4,7,10,12,15,13,14,8';
            const filterHoursStr = await this.settingRepo.get('remotar_filter_hours');
            const filterHours = parseInt(filterHoursStr || '48') || 48;

            const allJobs = await remotarScraperService.fetchRecentJobs(categories, 5);
            const recentJobs = remotarScraperService.filterRecentJobs(allJobs, filterHours);

            stats.processed += recentJobs.length;
            log(`Remotar: ${allJobs.length} total, ${recentJobs.length} das últimas ${filterHours}h`);

            for (const job of recentJobs) {
                try {
                    const postId = `remotar-${job.id}`;
                    if (await this.jobRepo.exists(postId)) { stats.skipped++; continue; }

                    const seniority = classifySeniority(job.title, job.tags, job.description);

                    await this.jobRepo.create({
                        linkedin_post_id: postId,
                        title: job.title,
                        company: job.company,
                        location: job.location,
                        is_remote: true,
                        raw_content: job.description.substring(0, 5000),
                        formatted_message: remotarScraperService.formatWhatsAppMessage(job),
                        url: job.externalLink || job.url,
                        posted_at: job.createdAt,
                        status: 'collected',
                        error_message: null,
                        seniority_level: seniority,
                    });

                    log(`Remotar: Coletada "${job.title}" (${job.company}) [${seniority}]`);
                } catch (error) {
                    dbLogger.error(`[JobOrchestration] Remotar error on job ${job.id}:`, error);
                    stats.errors++;
                }
            }
        } catch (error) {
            dbLogger.error('[JobOrchestration] Remotar collect failed:', error);
            log(`[Erro Crítico] Falha geral no Remotar: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async collectVagasRemotas(stats: CollectStats, log: (msg: string) => void): Promise<void> {
        try {
            const enabled = await this.settingRepo.get('vagasremotas_enabled');
            if (enabled !== 'true') { log('VagasRemotas: Pulando (não habilitado)'); return; }

            const filterHoursStr = await this.settingRepo.get('remotar_filter_hours');
            const filterHours = parseInt(filterHoursStr || '48') || 48;

            const allJobs = await vagasRemotasScraperService.fetchJobs();
            const recentJobs = vagasRemotasScraperService.filterRecentJobs(allJobs, filterHours);

            stats.processed += recentJobs.length;
            log(`VagasRemotas: ${allJobs.length} total, ${recentJobs.length} das últimas ${filterHours}h`);

            for (const job of recentJobs) {
                try {
                    const postId = `vagasremotas-${job.id}`;
                    if (await this.jobRepo.exists(postId)) { stats.skipped++; continue; }

                    const seniority = classifySeniority(job.title, job.tags, job.description);

                    await this.jobRepo.create({
                        linkedin_post_id: postId,
                        title: job.title,
                        company: job.company,
                        location: '100% Remoto',
                        is_remote: true,
                        raw_content: job.description.substring(0, 5000),
                        formatted_message: vagasRemotasScraperService.formatWhatsAppMessage(job),
                        url: job.url,
                        posted_at: new Date().toISOString(),
                        status: 'collected',
                        error_message: null,
                        seniority_level: seniority,
                    });

                    log(`VagasRemotas: Coletada "${job.title}" (${job.company}) [${seniority}]`);
                } catch (error) {
                    dbLogger.error(`[JobOrchestration] VagasRemotas error on job ${job.id}:`, error);
                    stats.errors++;
                }
            }
        } catch (error) {
            dbLogger.error('[JobOrchestration] VagasRemotas collect failed:', error);
            log(`[Erro Crítico] Falha geral no VagasRemotas: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async collectWorkei(stats: CollectStats, log: (msg: string) => void): Promise<void> {
        try {
            const enabled = await this.settingRepo.get('workei_enabled');
            if (enabled !== 'true') { log('Workei: Pulando (não habilitado)'); return; }

            const filterHoursStr = await this.settingRepo.get('workei_filter_hours')
                || await this.settingRepo.get('remotar_filter_hours');
            const filterHours = parseInt(filterHoursStr || '48') || 48;

            const allJobs = await workeiScraperService.fetchRecentJobs(10);
            const recentJobs = workeiScraperService.filterRecentJobs(allJobs, filterHours);

            stats.processed += recentJobs.length;
            log(`Workei: ${allJobs.length} total, ${recentJobs.length} das últimas ${filterHours}h`);

            for (const job of recentJobs) {
                try {
                    const postId = `workei-${job.id}`;
                    if (await this.jobRepo.exists(postId)) { stats.skipped++; continue; }

                    const seniority = classifySeniority(job.title, [], job.description);

                    await this.jobRepo.create({
                        linkedin_post_id: postId,
                        title: job.title,
                        company: job.company,
                        location: job.location,
                        is_remote: true,
                        raw_content: job.description.substring(0, 5000),
                        formatted_message: workeiScraperService.formatWhatsAppMessage(job),
                        url: job.url,
                        posted_at: job.createdAt.toISOString(),
                        status: 'collected',
                        error_message: null,
                        seniority_level: seniority,
                    });

                    log(`Workei: Coletada "${job.title}" (${job.company}) [${seniority}]`);
                } catch (error) {
                    dbLogger.error(`[JobOrchestration] Workei error on job ${job.id}:`, error);
                    stats.errors++;
                }
            }
        } catch (error) {
            dbLogger.error('[JobOrchestration] Workei collect failed:', error);
            log(`[Erro Crítico] Falha geral no Workei: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // ========================================================================
    // PHASE 2 — GROUP & SEND
    // ========================================================================

    /**
     * Fetches all 'collected' jobs, groups by seniority, sends one message per level + daily summary.
     */
    private async sendGroupedMessages(
        groupId: string,
        stats: Pick<SyncResult, 'posted' | 'errors'>,
        log: (msg: string) => void,
    ): Promise<void> {
        const grouped = await this.jobRepo.getCollectedGroupedByLevel();

        const levels: SeniorityLevel[] = ['estagio', 'junior', 'pleno', 'senior', 'outros'];
        const statsByLevel: Record<SeniorityLevel, number> = {
            estagio: 0, junior: 0, pleno: 0, senior: 0, outros: 0,
        };
        let totalPostedInBatch = 0;

        const totalCollected = levels.reduce((sum, l) => sum + grouped[l].length, 0);
        if (totalCollected === 0) {
            log('📭 Nenhuma vaga nova coletada nesta sincronização. Fontes ativas retornaram 0 vagas nas últimas 48h ou todas já foram enviadas anteriormente.');
            return;
        }

        for (const level of levels) {
            const jobs = grouped[level];
            if (jobs.length === 0) continue;

            statsByLevel[level] = jobs.length;

            const items: GroupedJobItem[] = jobs.map(j => ({
                title: j.title,
                company: j.company,
                location: j.location || '100% Remoto',
                url: j.url || '',
                description: j.raw_content?.substring(0, 200) || '',
            }));

            const message = formatGroupByLevel(level, items);
            const ids = jobs.map(j => j.id);

            try {
                await whatsAppGroupService.sendToGroupById(groupId, message, {
                    idempotencyKey: `jobs:grouped:${level}:${new Date().toISOString().slice(0, 10)}`,
                    idempotencyTtlSeconds: 24 * 60 * 60,
                });

                await this.jobRepo.bulkUpdateStatus(ids, 'posted');
                totalPostedInBatch += ids.length;
                stats.posted += ids.length;
                log(`Enviadas ${ids.length} vagas de ${level} em mensagem consolidada.`);
            } catch (error) {
                await this.jobRepo.bulkUpdateStatus(ids, 'error', error instanceof Error ? error.message : String(error));
                stats.errors += ids.length;
                dbLogger.error(`[JobOrchestration] Error sending grouped ${level}:`, error);
                log(`[Erro] Falha ao enviar vagas de ${level}: ${error instanceof Error ? error.message : String(error)}`);
            }

            // Delay between group sends to avoid WhatsApp blocking
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // ── Daily summary message ──────────────────────────────────────
        if (totalPostedInBatch > 0) {
            try {
                const quote = await this.generateMotivationalQuote();
                const summaryMsg = formatDailySummary(statsByLevel, quote);

                await whatsAppGroupService.sendToGroupById(groupId, summaryMsg, {
                    idempotencyKey: `jobs:summary:${new Date().toISOString().slice(0, 10)}`,
                    idempotencyTtlSeconds: 24 * 60 * 60,
                });

                log(`Resumo diário enviado: ${totalPostedInBatch} vagas no total.`);
            } catch (error) {
                dbLogger.error('[JobOrchestration] Error sending daily summary:', error);
                log(`[Aviso] Falha ao enviar resumo diário: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    /**
     * Generate a short motivational quote via OpenAI.
     * Falls back to a static list if the API call fails.
     */
    private async generateMotivationalQuote(): Promise<string> {
        const fallbackQuotes = [
            'O sucesso é a soma de pequenos esforços repetidos dia após dia.',
            'Não espere por oportunidades, crie-as.',
            'Cada vaga é uma porta. Bata em todas.',
            'A persistência é o caminho do êxito.',
            'Seu próximo emprego pode ser o que muda tudo.',
        ];

        try {
            const OpenAI = (await import('openai')).default;
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) return fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];

            const openai = new OpenAI({ apiKey });
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'user',
                    content: 'Gere uma frase motivacional curta (máximo 1 linha) sobre busca de emprego e carreira em TI. Apenas a frase, sem aspas.',
                }],
                temperature: 0.9,
                max_tokens: 60,
            });

            return completion.choices[0]?.message?.content?.trim() || fallbackQuotes[0];
        } catch {
            return fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
        }
    }
}

export const jobOrchestrationService = new JobOrchestrationService();
