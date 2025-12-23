"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueAutomationService = exports.QueueAutomationService = void 0;
const db_1 = require("../lib/db");
const messageQueue_1 = require("../lib/messageQueue");
const QueueAutomationRepository_1 = require("../repositories/QueueAutomationRepository");
const LeadRepository_1 = require("../lib/repositories/LeadRepository");
const TemplateRepository_1 = require("../lib/repositories/TemplateRepository");
const logger_1 = require("../lib/logger");
// Brazil timezone offset (UTC-3)
const BRAZIL_TIMEZONE_OFFSET = -3;
// Loop intervals
const LOOP_INTERVAL_WORKING_MS = 5 * 60 * 1000; // 5 minutes
const LOOP_INTERVAL_IDLE_MS = 10 * 60 * 1000; // 10 minutes
/**
 * QueueAutomationService handles sending messages when queue is idle
 */
class QueueAutomationService {
    constructor(automationRepo = QueueAutomationRepository_1.queueAutomationRepository, leadRepo = new LeadRepository_1.LeadRepository(), templateRepo = new TemplateRepository_1.TemplateRepository()) {
        this.automationRepo = automationRepo;
        this.leadRepo = leadRepo;
        this.templateRepo = templateRepo;
        // Loop control properties
        this.loopInterval = null;
        this.loopRunning = false;
    }
    /**
     * Get current hour in Brazil timezone (UTC-3)
     */
    getCurrentHourBrazil() {
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
    isWithinOperatingHours(config) {
        const currentHour = this.getCurrentHourBrazil();
        return currentHour >= config.startHour && currentHour < config.endHour;
    }
    /**
     * Get the automation configuration
     */
    async getConfig() {
        return this.automationRepo.getConfig();
    }
    /**
     * Update automation configuration
     */
    async updateConfig(config) {
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
    async getNextEligibleLead(targetStatus) {
        let query = `
            SELECT l.cpf, l.nome, l.telefone
            FROM leads l
            LEFT JOIN queue_automation_log qal ON l.cpf = qal.lead_cpf AND qal.success = true
            WHERE l.telefone IS NOT NULL
              AND l.telefone != ''
              AND qal.id IS NULL
        `;
        const params = [];
        if (targetStatus) {
            query += ` AND l.status = $1`;
            params.push(targetStatus);
        }
        query += ` ORDER BY l.created_at ASC LIMIT 1`;
        const result = await db_1.pool.query(query, params);
        return result.rows[0] || null;
    }
    /**
     * Get current automation status
     */
    async getStatus() {
        var _a;
        const config = await this.getConfig();
        const stats = await this.automationRepo.getLogStats();
        const queueState = messageQueue_1.messageQueue.getState();
        const isActive = (_a = config === null || config === void 0 ? void 0 : config.isActive) !== null && _a !== void 0 ? _a : false;
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
    async onQueueEmpty() {
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
            messageQueue_1.messageQueue.enqueue([{
                    phone: lead.telefone,
                    name: lead.nome || '',
                    message: template.message,
                    cpf: lead.cpf,
                    templateId: template.id,
                    templateName: template.name,
                    isAi: true // Always use AI for queue automation
                }]);
            await this.automationRepo.logSend(lead.cpf, config.templateId, true);
            logger_1.queueLogger.info(`Message queued for ${lead.nome || lead.cpf}`);
            return { sent: true, reason: 'Mensagem enfileirada com sucesso' };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            // Log the failure
            await this.automationRepo.logSend(lead.cpf, config.templateId, false, errorMessage);
            logger_1.queueLogger.error('Error queueing message:', error);
            return { sent: false, reason: `Erro ao enfileirar: ${errorMessage}` };
        }
    }
    /**
     * Reset automation log (allows re-sending to all leads)
     */
    async resetLog() {
        await db_1.pool.query('DELETE FROM queue_automation_log');
    }
    /**
     * Check if the automation loop is running
     */
    isLoopRunning() {
        return this.loopRunning;
    }
    /**
     * Start the automation loop
     * Continuously sends messages while within operating hours
     */
    async startLoop() {
        if (this.loopRunning) {
            return { success: false, message: 'Automação já está em execução' };
        }
        const config = await this.getConfig();
        if (!(config === null || config === void 0 ? void 0 : config.isActive)) {
            return { success: false, message: 'Automação não está ativada' };
        }
        if (!config.templateId) {
            return { success: false, message: 'Nenhum template configurado' };
        }
        this.loopRunning = true;
        messageQueue_1.messageQueue.addLog('▶️ Automação de Fila Vazia iniciada', 'success');
        logger_1.queueLogger.info('Loop iniciado');
        // Start the continuous loop
        this.runLoop();
        return { success: true, message: 'Automação iniciada' };
    }
    /**
     * Stop the automation loop
     */
    stopLoop() {
        this.loopRunning = false;
        if (this.loopInterval) {
            clearTimeout(this.loopInterval);
            this.loopInterval = null;
        }
        messageQueue_1.messageQueue.addLog('⏸️ Automação de Fila Vazia pausada', 'info');
        logger_1.queueLogger.info('Loop pausado');
    }
    /**
     * Main loop - sends messages one at a time, waiting for queue to empty
     */
    async runLoop() {
        if (!this.loopRunning)
            return;
        try {
            // Check if queue is currently processing - wait if so
            const queueState = messageQueue_1.messageQueue.getState();
            if (queueState.queueLength > 0 || queueState.processing) {
                // Queue still has items, check again in 5 minutes
                this.loopInterval = setTimeout(() => this.runLoop(), LOOP_INTERVAL_WORKING_MS);
                return;
            }
            // Queue is empty, try to add next lead
            const result = await this.onQueueEmpty();
            if (result.sent) {
                // Log success to WhatsApp terminal
                messageQueue_1.messageQueue.addLog(`[Automação] ${result.reason}`, 'success');
                // Wait for this message to be sent before checking for next
                // Check every 5 minutes until queue is empty again
                this.loopInterval = setTimeout(() => this.runLoop(), LOOP_INTERVAL_WORKING_MS);
            }
            else {
                // No lead available or outside hours, check again in 10 minutes
                const config = await this.getConfig();
                if (config === null || config === void 0 ? void 0 : config.isActive) {
                    messageQueue_1.messageQueue.addLog(`[Automação] ${result.reason}`, 'info');
                }
                this.loopInterval = setTimeout(() => this.runLoop(), LOOP_INTERVAL_IDLE_MS);
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
            messageQueue_1.messageQueue.addLog(`[Automação] Erro: ${errorMsg}`, 'error');
            logger_1.queueLogger.error('Loop error:', error);
            // Retry in 10 minutes on error
            this.loopInterval = setTimeout(() => this.runLoop(), LOOP_INTERVAL_IDLE_MS);
        }
    }
}
exports.QueueAutomationService = QueueAutomationService;
// Export singleton instance
exports.queueAutomationService = new QueueAutomationService();
