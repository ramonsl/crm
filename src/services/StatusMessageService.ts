/**
 * StatusMessageService
 * 
 * Orchestrates automated message sending when leads change status.
 * 
 * Responsibilities:
 * - Check if status actually changed
 * - Check if message was already sent for this CPF+status
 * - Get template associated with the new status
 * - Queue message for sending
 * - Log the send to prevent duplicates
 * 
 * Following SOLID:
 * - SRP: Only handles status-based message automation
 * - DIP: Dependencies injected via constructor
 * - OCP: Can be extended to support new automation rules
 */

import { StatusTemplateRepository, statusTemplateRepository } from '@/lib/repositories/StatusTemplateRepository';
import { StatusMessageLogRepository, statusMessageLogRepository } from '@/lib/repositories/StatusMessageLogRepository';
import { LeadRepository } from '@/lib/repositories/LeadRepository';
import { TemplateRepository } from '@/lib/repositories/TemplateRepository';
import { messageQueue } from '@/lib/messageQueue';
import { queueLogger } from '@/lib/logger';

export interface ProcessStatusChangeResult {
    sent: boolean;
    reason: string;
}

export class StatusMessageService {
    constructor(
        private statusTemplateRepo: StatusTemplateRepository = statusTemplateRepository,
        private statusMessageLogRepo: StatusMessageLogRepository = statusMessageLogRepository,
        private leadRepo: LeadRepository = new LeadRepository(),
        private templateRepo: TemplateRepository = new TemplateRepository()
    ) { }

    /**
     * Process a status change and send automated message if applicable
     * 
     * @param cpf - Lead CPF
     * @param oldStatus - Previous status
     * @param newStatus - New status
     * @returns Result indicating if message was sent and why
     */
    async processStatusChange(
        cpf: string,
        oldStatus: string,
        newStatus: string
    ): Promise<ProcessStatusChangeResult> {
        // 1. Verify status actually changed
        if (oldStatus === newStatus) {
            return { sent: false, reason: 'Status não mudou' };
        }

        // 2. Check if message was already sent for this CPF+status
        const alreadySent = await this.statusMessageLogRepo.hasBeenSent(cpf, newStatus);
        if (alreadySent) {
            queueLogger.debug(`Message already sent for CPF ${cpf} + status "${newStatus}"`);
            return { sent: false, reason: 'Mensagem já enviada anteriormente para este status' };
        }

        // 3. Get template associated with this status
        const statusTemplate = await this.statusTemplateRepo.findByStatus(newStatus);
        if (!statusTemplate || !statusTemplate.template_id) {
            return { sent: false, reason: 'Nenhum template configurado para este status' };
        }

        if (!statusTemplate.is_active) {
            return { sent: false, reason: 'Automação desativada para este status' };
        }

        // 4. Get lead and template data
        const lead = await this.leadRepo.findByCpf(cpf);
        if (!lead) {
            return { sent: false, reason: 'Lead não encontrado' };
        }

        if (!lead.telefone) {
            return { sent: false, reason: 'Lead sem telefone cadastrado' };
        }

        const template = await this.templateRepo.findById(statusTemplate.template_id);
        if (!template) {
            return { sent: false, reason: 'Template não encontrado' };
        }

        // 5. Queue message for sending
        try {
            messageQueue.enqueue([{
                phone: lead.telefone,
                name: lead.nome || '',
                message: template.message,
                cpf: cpf,
                templateId: template.id,
                templateName: template.name
            }]);

            // 6. Log the send to prevent future duplicates
            await this.statusMessageLogRepo.logSent(
                cpf,
                newStatus,
                template.id,
                undefined // messageId will be set by queue processor
            );

            queueLogger.info(`Message queued for CPF ${cpf} on status change to "${newStatus}"`);
            return { sent: true, reason: 'Mensagem enfileirada com sucesso' };

        } catch (error) {
            queueLogger.error('Error queueing message:', error);
            return { sent: false, reason: 'Erro ao enfileirar mensagem' };
        }
    }

    /**
     * Reset the message log for a specific CPF+status (allows re-sending)
     */
    async resetLogEntry(cpf: string, statusName: string): Promise<void> {
        await this.statusMessageLogRepo.deleteEntry(cpf, statusName);
    }

    /**
     * Get all pending status changes that would trigger messages
     * (useful for preview/debugging)
     */
    async getMessageLog(cpf: string) {
        return this.statusMessageLogRepo.findByCpf(cpf);
    }
}

// Export singleton instance
export const statusMessageService = new StatusMessageService();
