/**
 * DirectJobIntakeService
 *
 * Responsibility: Detect, process, and dispatch job vacancies received via direct WhatsApp messages.
 * Handles two intake modes:
 *   1. Link-based: A short message containing a URL to a job posting.
 *   2. Text-based: A long forwarded job description (no URL required).
 *
 * This service replaces the inline handlers previously embedded in BaileysMessageHandler,
 * following the architecture rule: Handler → Service → Repository.
 */

import { whatsappLogger } from '@/lib/logger';
import { whatsAppGroupService } from './whatsAppGroupService';
import { whatsAppChatService } from './WhatsAppChatService';
import { LinkedInJobRepository } from '@/lib/repositories/LinkedInJobRepository';
import { SettingRepository } from '@/lib/repositories/SettingRepository';
import type { ILinkedInJobRepository } from '@/lib/repositories/interfaces';
import type { ISettingRepository } from '@/lib/repositories/interfaces';
import type { WhatsAppMessage } from '@/lib/whatsapp/IWhatsAppProvider';

const JOB_LINK_DOMAINS = [
    'lnkd.in',
    'linkedin.com/jobs',
    'gupy.io',
    'remotar',
    'vagas',
] as const;

const JOB_TEXT_KEYWORDS = [
    'vaga',
    'oportunidade',
    'contratando',
    'estamos contratando',
    'hiring',
    'desenvolvedor',
    'programador',
    'remoto',
    'homeoffice',
    'home office',
    'salário',
    'requisitos',
    'currículo',
    'curriculum',
    'cv',
] as const;

const MIN_JOB_TEXT_LENGTH = 150;

export class DirectJobIntakeService {
    constructor(
        private readonly jobRepo: ILinkedInJobRepository = new LinkedInJobRepository(),
        private readonly settingRepo: ISettingRepository = new SettingRepository(),
    ) { }

    /**
     * Entry point: try to process a direct message as a job vacancy.
     * Tries link-based first; if not matched, tries text-based.
     *
     * @returns `true` if the message was handled as a job intake, `false` otherwise.
     */
    async processDirectJobMessage(msg: WhatsAppMessage): Promise<boolean> {
        if (msg.fromMe || msg.isGroup) return false;

        const handledAsLink = await this.handleJobLink(msg);
        if (handledAsLink) return true;

        return this.handleForwardedJobText(msg);
    }

    // =========================================================================
    // INTAKE MODE 1 — Link-based
    // =========================================================================

    private async handleJobLink(msg: WhatsAppMessage): Promise<boolean> {
        // Long messages are more likely full job descriptions; defer to text handler.
        if (msg.body && msg.body.length >= MIN_JOB_TEXT_LENGTH) return false;

        const urlMatch = msg.body?.match(/(https?:\/\/[^\s]+)/g);
        if (!urlMatch || urlMatch.length === 0) return false;

        const url = urlMatch[0].toLowerCase();
        const bodyLower = msg.body?.toLowerCase() ?? '';

        const isJobDomain = JOB_LINK_DOMAINS.some(d => url.includes(d));
        const seemsLikeJob = isJobDomain || bodyLower.includes('vaga') || bodyLower.includes('remoto');

        if (!seemsLikeJob) return false;

        try {
            const { jobTransformerService } = await import('./JobTransformerService');
            const { htmlScraperService } = await import('./HtmlScraperService');

            whatsappLogger.info(`[DirectJobIntake] Processing job link from ${msg.from}: ${urlMatch[0]}`);

            await whatsAppChatService.sendTextMessage(
                msg.from,
                '🔍 Identifiquei um link de vaga. Estou processando...',
            );

            const scrapedText = await htmlScraperService.scrapeUrlText(urlMatch[0]);
            const fullContext = `Mensagem original: ${msg.body}\n\nConteúdo do link:\n${scrapedText}`;
            const pseudoId = `manual-${Date.now()}`;

            const parsedJob = await jobTransformerService.transformPost(fullContext, pseudoId, urlMatch[0]);

            if (!parsedJob || !parsedJob.isJob) {
                whatsappLogger.debug(
                    `[DirectJobIntake] Link not recognized as job. Result: ${JSON.stringify(parsedJob)}`,
                );
                return false; // Allow fallback to text handler
            }

            const formattedMessage = jobTransformerService.formatWhatsAppMessage(parsedJob);

            await this.jobRepo.create({
                linkedin_post_id: parsedJob.post_id,
                title: parsedJob.title,
                company: parsedJob.company,
                location: parsedJob.location,
                is_remote: parsedJob.isRemote,
                raw_content: fullContext.substring(0, 5000),
                formatted_message: formattedMessage,
                url: parsedJob.applicationLink,
                posted_at: new Date().toISOString(),
                status: 'posted',
                error_message: null,
                seniority_level: 'outros',
            });

            const linkedinGroupId = await this.settingRepo.get('linkedin_group_id');

            if (linkedinGroupId) {
                await whatsAppGroupService.sendToGroupById(linkedinGroupId, formattedMessage);
                await whatsAppChatService.sendTextMessage(
                    msg.from,
                    '✅ Vaga processada e enviada para o grupo com sucesso!',
                );
            } else {
                await whatsAppChatService.sendTextMessage(
                    msg.from,
                    '⚠️ Vaga processada, mas o grupo de destino não está configurado.',
                );
            }

            return true;
        } catch (error) {
            whatsappLogger.error('[DirectJobIntake] Error processing job link (falling back to text):', error);
            return false;
        }
    }

    // =========================================================================
    // INTAKE MODE 2 — Text-based (forwarded descriptions)
    // =========================================================================

    private async handleForwardedJobText(msg: WhatsAppMessage): Promise<boolean> {
        const body = msg.body?.trim() ?? '';
        if (body.length < MIN_JOB_TEXT_LENGTH) return false;

        const bodyLower = body.toLowerCase();
        const hasJobKeyword = JOB_TEXT_KEYWORDS.some(kw => bodyLower.includes(kw));
        if (!hasJobKeyword) return false;

        try {
            const { jobTransformerService } = await import('./JobTransformerService');

            whatsappLogger.info(`[DirectJobIntake] Forwarded job text detected from ${msg.from}`);

            await whatsAppChatService.sendTextMessage(
                msg.from,
                '🔍 Identifiquei um texto de vaga. Estou reescrevendo...',
            );

            const result = await jobTransformerService.rewriteForwardedJobText(body);

            if (!result.isJob || !result.formattedMessage) {
                await whatsAppChatService.sendTextMessage(
                    msg.from,
                    'ℹ️ O texto enviado não parece descrever uma vaga de emprego válida.',
                );
                return true; // Handled (no fallback needed)
            }

            const pseudoId = `forwarded-${Date.now()}`;

            await this.jobRepo.create({
                linkedin_post_id: pseudoId,
                title: 'Vaga Encaminhada (Texto)',
                company: 'Empresa (via Texto)',
                location: '',
                is_remote: false,
                raw_content: body.substring(0, 5000),
                formatted_message: result.formattedMessage,
                url: result.applicationLink || '',
                posted_at: new Date().toISOString(),
                status: 'posted',
                error_message: null,
                seniority_level: 'outros',
            });

            const linkedinGroupId = await this.settingRepo.get('linkedin_group_id');

            if (linkedinGroupId) {
                try {
                    await whatsAppGroupService.sendToGroupById(linkedinGroupId, result.formattedMessage);
                } catch (sendError) {
                    // The message may have been delivered even if the ACK timed out (Baileys race condition).
                    // Log the error but don't propagate — the job was already saved and likely sent.
                    whatsappLogger.warn('[DirectJobIntake] Group send returned an error (message may still have been delivered):', sendError);
                }
                await whatsAppChatService.sendTextMessage(
                    msg.from,
                    '✅ Vaga reescrita e enviada para o grupo com sucesso!',
                );
            } else {
                whatsappLogger.warn('[DirectJobIntake] linkedin_group_id not configured');
                await whatsAppChatService.sendTextMessage(
                    msg.from,
                    '⚠️ Vaga processada, mas o grupo de destino não está configurado.',
                );
            }

            return true;
        } catch (error) {
            whatsappLogger.error('[DirectJobIntake] Fatal error processing forwarded job text:', error);
            if (error instanceof Error) {
                whatsappLogger.error(`[DirectJobIntake] Stack: ${error.stack}`);
            }
            await whatsAppChatService.sendTextMessage(
                msg.from,
                '⚠️ Ocorreu um erro ao processar a descrição da vaga.',
            );
            return true; // Handled (error notified)
        }
    }
}

export const directJobIntakeService = new DirectJobIntakeService();
