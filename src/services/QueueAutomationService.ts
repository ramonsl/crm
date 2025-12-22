/**
 * QueueAutomationService
 * 
 * Orchestrates the queue idle automation feature.
 * When the message queue is empty, this service automatically sends 
 * messages to eligible leads within operating hours.
 * 
 * Following SOLID:
 * - SRP: Only handles queue idle automation logic
 * - DIP: Dependencies injected via constructor
 * - OCP: Can be extended with new eligibility criteria
 */

import { pool } from '@/lib/db';
import { messageQueue } from '@/lib/messageQueue';
import type { LeadRow } from '@/lib/types';
import type { QueueAutomationConfig, QueueAutomationStatus } from '@/types/queueAutomation';
import {
    IQueueAutomationRepository,
    queueAutomationRepository
} from '@/repositories/QueueAutomationRepository';
import { LeadRepository } from '@/lib/repositories/LeadRepository';
import { TemplateRepository } from '@/lib/repositories/TemplateRepository';

// Brazil timezone offset (UTC-3)
const BRAZIL_TIMEZONE_OFFSET = -3;

/**
 * Interface for eligible lead data
 */
interface EligibleLead {
    cpf: string;
    nome: string | null;
    telefone: string;
}

/**
 * QueueAutomationService handles sending messages when queue is idle
 */
export class QueueAutomationService {
    // Loop control properties
    private loopInterval: NodeJS.Timeout | null = null;
    private loopRunning = false;

    constructor(
        private automationRepo: IQueueAutomationRepository = queueAutomationRepository,
        private leadRepo: LeadRepository = new LeadRepository(),
        private templateRepo: TemplateRepository = new TemplateRepository()
    ) { }

    /**
     * Get current hour in Brazil timezone (UTC-3)
     */
    getCurrentHourBrazil(): number {
        const now = new Date();
        const utcHours = now.getUTCHours();
        let brazilHours = utcHours + BRAZIL_TIMEZONE_OFFSET;

        // Handle day wrap-around
        if (brazilHours < 0) {
            brazilHours += 24;
        }

        return brazilHours;
    }

    /**
     * Check if current time is within operating hours
     */
    isWithinOperatingHours(config: QueueAutomationConfig): boolean {
        const currentHour = this.getCurrentHourBrazil();
        return currentHour >= config.startHour && currentHour < config.endHour;
    }

    /**
     * Get the automation configuration
     */
    async getConfig(): Promise<QueueAutomationConfig | null> {
        return this.automationRepo.getConfig();
    }

    /**
     * Update automation configuration
     */
    async updateConfig(
        config: Partial<Omit<QueueAutomationConfig, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<void> {
        await this.automationRepo.updateConfig(config);
    }

    /**
     * Get the next eligible lead for automation
     * 
     * Eligibility criteria:
     * 1. Has valid phone number
     * 2. Has not been contacted by this automation yet
     * 3. Matches target status (if specified)
     * 4. Ordered by created_at (oldest first)
     */
    async getNextEligibleLead(targetStatus?: string | null): Promise<EligibleLead | null> {
        let query = `
            SELECT l.cpf, l.nome, l.telefone
            FROM leads l
            LEFT JOIN queue_automation_log qal ON l.cpf = qal.lead_cpf AND qal.success = true
            WHERE l.telefone IS NOT NULL
              AND l.telefone != ''
              AND qal.id IS NULL
        `;

        const params: string[] = [];

        if (targetStatus) {
            query += ` AND l.status = $1`;
            params.push(targetStatus);
        }

        query += ` ORDER BY l.created_at ASC LIMIT 1`;

        const result = await pool.query<EligibleLead>(query, params);

        return result.rows[0] || null;
    }

    /**
     * Get current automation status
     */
    async getStatus(): Promise<QueueAutomationStatus> {
        const config = await this.getConfig();
        const stats = await this.automationRepo.getLogStats();
        const queueState = messageQueue.getState();

        const isActive = config?.isActive ?? false;
        const isWithinHours = config ? this.isWithinOperatingHours(config) : false;

        return {
            isActive,
            isRunning: this.loopRunning,
            isWithinOperatingHours: isWithinHours,
            currentHourBrazil: this.getCurrentHourBrazil(),
            totalSent: stats.totalSent,
            lastSentAt: stats.lastSentAt,
            queueLength: queueState.queueLength
        };
    }

    /**
     * Main trigger - called when queue becomes empty
     * 
     * This method:
     * 1. Checks if automation is active
     * 2. Checks if within operating hours
     * 3. Finds next eligible lead
     * 4. Queues message for sending
     */
    async onQueueEmpty(): Promise<{ sent: boolean; reason: string }> {
        // 1. Get configuration
        const config = await this.getConfig();
        if (!config) {
            return { sent: false, reason: 'Configuração não encontrada' };
        }

        // 2. Check if automation is active
        if (!config.isActive) {
            return { sent: false, reason: 'Automação desativada' };
        }

        // 3. Check operating hours
        if (!this.isWithinOperatingHours(config)) {
            const currentHour = this.getCurrentHourBrazil();
            return {
                sent: false,
                reason: `Fora do horário de operação (${config.startHour}h-${config.endHour}h). Hora atual: ${currentHour}h`
            };
        }

        // 4. Check if template is configured
        if (!config.templateId) {
            return { sent: false, reason: 'Nenhum template configurado' };
        }

        // 5. Get template
        const template = await this.templateRepo.findById(config.templateId);
        if (!template) {
            return { sent: false, reason: 'Template não encontrado' };
        }

        // 6. Get next eligible lead (filtered by status if configured)
        const lead = await this.getNextEligibleLead(config.targetStatus);
        if (!lead) {
            const statusInfo = config.targetStatus ? ` com status "${config.targetStatus}"` : '';
            return { sent: false, reason: `Nenhum lead elegível disponível${statusInfo}` };
        }

        // 7. Queue message (always use AI for automation)
        try {
            messageQueue.enqueue([{
                phone: lead.telefone,
                name: lead.nome || '',
                message: template.message,
                cpf: lead.cpf,
                templateId: template.id,
                templateName: template.name,
                isAi: true // Always use AI for queue automation
            }]);

            // 8. Log the send
            await this.automationRepo.logSend(lead.cpf, config.templateId, true);

            console.log(`[QueueAutomationService] ✅ Message queued for ${lead.nome || lead.cpf}`);
            return { sent: true, reason: 'Mensagem enfileirada com sucesso' };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

            // Log the failure
            await this.automationRepo.logSend(lead.cpf, config.templateId, false, errorMessage);

            console.error('[QueueAutomationService] Error queueing message:', error);
            return { sent: false, reason: `Erro ao enfileirar: ${errorMessage}` };
        }
    }

    /**
     * Reset automation log (allows re-sending to all leads)
     */
    async resetLog(): Promise<void> {
        await pool.query('DELETE FROM queue_automation_log');
    }

    /**
     * Check if the automation loop is running
     */
    isLoopRunning(): boolean {
        return this.loopRunning;
    }

    /**
     * Start the automation loop
     * Continuously sends messages while within operating hours
     */
    async startLoop(): Promise<{ success: boolean; message: string }> {
        if (this.loopRunning) {
            return { success: false, message: 'Automação já está em execução' };
        }

        const config = await this.getConfig();
        if (!config?.isActive) {
            return { success: false, message: 'Automação não está ativada' };
        }

        if (!config.templateId) {
            return { success: false, message: 'Nenhum template configurado' };
        }

        this.loopRunning = true;
        messageQueue.addLog('▶️ Automação de Fila Vazia iniciada', 'success');
        console.log('[QueueAutomationService] ▶️ Loop iniciado');

        // Start the continuous loop
        this.runLoop();

        return { success: true, message: 'Automação iniciada' };
    }

    /**
     * Stop the automation loop
     */
    stopLoop(): void {
        this.loopRunning = false;
        if (this.loopInterval) {
            clearTimeout(this.loopInterval);
            this.loopInterval = null;
        }
        messageQueue.addLog('⏸️ Automação de Fila Vazia pausada', 'info');
        console.log('[QueueAutomationService] ⏸️ Loop pausado');
    }

    /**
     * Main loop - sends messages one at a time, waiting for queue to empty
     */
    private async runLoop(): Promise<void> {
        if (!this.loopRunning) return;

        try {
            // Check if queue is currently processing - wait if so
            const queueState = messageQueue.getState();
            if (queueState.queueLength > 0 || queueState.processing) {
                // Queue still has items, check again in 5 seconds
                this.loopInterval = setTimeout(() => this.runLoop(), 5000);
                return;
            }

            // Queue is empty, try to add next lead
            const result = await this.onQueueEmpty();

            if (result.sent) {
                // Log success to WhatsApp terminal
                messageQueue.addLog(`[Automação] ${result.reason}`, 'success');
                // Wait for this message to be sent before checking for next
                // Check every 5 seconds until queue is empty again
                this.loopInterval = setTimeout(() => this.runLoop(), 5000);
            } else {
                // No lead available or outside hours, check again in 1 minute
                const config = await this.getConfig();
                if (config?.isActive) {
                    messageQueue.addLog(`[Automação] ${result.reason}`, 'info');
                }
                this.loopInterval = setTimeout(() => this.runLoop(), 60000);
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
            messageQueue.addLog(`[Automação] Erro: ${errorMsg}`, 'error');
            console.error('[QueueAutomationService] Loop error:', error);
            // Retry in 1 minute on error
            this.loopInterval = setTimeout(() => this.runLoop(), 60000);
        }
    }
}

// Export singleton instance
export const queueAutomationService = new QueueAutomationService();
