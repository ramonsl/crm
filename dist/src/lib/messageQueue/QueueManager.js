"use strict";
/**
 * Queue Manager
 *
 * Manages the message queue lifecycle: enqueue, process, clear.
 * Following SRP: Only handles queue management logic.
 * Following DIP: Depends on abstractions for AI generation, history recording, and message sending.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueManager = void 0;
const constants_1 = require("../constants");
const logger_1 = require("../../lib/logger");
class QueueManager {
    constructor(aiGenerator, historyRecorder, settingsProvider) {
        this.aiGenerator = aiGenerator;
        this.historyRecorder = historyRecorder;
        this.settingsProvider = settingsProvider;
        this.queue = [];
        this.processing = false;
        this.logs = [];
        this.stats = { total: 0, processed: 0, failed: 0 };
        this.lastDelaySettings = { minDelay: 30000, maxDelay: 60000 };
    }
    /**
     * Factory method to get singleton instance
     */
    static getInstance(aiGenerator, historyRecorder, settingsProvider) {
        if (!global.messageQueueInstance_v9) {
            global.messageQueueInstance_v9 = new QueueManager(aiGenerator, historyRecorder, settingsProvider);
        }
        return global.messageQueueInstance_v9;
    }
    /**
     * Add messages to the queue
     */
    enqueue(items) {
        const newItems = items.map(item => ({
            id: Math.random().toString(36).substring(7),
            phone: item.phone,
            message: item.message,
            name: item.name,
            cpf: item.cpf,
            isAi: item.isAi,
            templateId: item.templateId,
            templateName: item.templateName,
            status: 'pending',
            addedAt: new Date()
        }));
        this.queue.push(...newItems);
        this.stats.total += newItems.length;
        this.addLog(`Enqueued ${newItems.length} messages.`, 'info');
        if (!this.processing) {
            this.process();
        }
    }
    /**
     * Clear all pending messages from queue
     */
    clear() {
        const count = this.queue.length;
        this.queue = [];
        this.stats.total = Math.max(0, this.stats.total - count);
        this.addLog('Queue cleared by user.', 'info');
    }
    /**
     * Add a log entry
     */
    addLog(message, type) {
        this.logs.unshift({ timestamp: new Date(), message, type });
        if (this.logs.length > constants_1.QUEUE_CONFIG.MAX_LOGS_COUNT) {
            this.logs.pop();
        }
    }
    /**
     * Get current queue state
     */
    getState() {
        const remainingMessages = this.queue.length;
        const averageDelay = (this.lastDelaySettings.minDelay + this.lastDelaySettings.maxDelay) / 2;
        const estimatedTimeSeconds = remainingMessages > 0
            ? Math.round((remainingMessages * averageDelay) / 1000)
            : 0;
        return {
            queueLength: this.queue.length,
            processing: this.processing,
            logs: this.logs,
            stats: this.stats,
            currentItem: this.queue[0] || null,
            estimatedTimeRemaining: estimatedTimeSeconds
        };
    }
    /**
     * Get delay settings from database
     */
    async getDelaySettings() {
        let minDelay = 30000;
        let maxDelay = 60000;
        try {
            const settings = await this.settingsProvider.getMultiple([
                'queue_min_delay',
                'queue_max_delay'
            ]);
            settings.forEach(setting => {
                if (setting.key === 'queue_min_delay') {
                    minDelay = parseInt(setting.value) * 1000;
                }
                if (setting.key === 'queue_max_delay') {
                    maxDelay = parseInt(setting.value) * 1000;
                }
            });
        }
        catch (e) {
            logger_1.queueLogger.error('Error fetching delay settings:', e);
        }
        if (isNaN(minDelay))
            minDelay = 30000;
        if (isNaN(maxDelay))
            maxDelay = 60000;
        if (maxDelay < minDelay)
            maxDelay = minDelay;
        this.lastDelaySettings = { minDelay, maxDelay };
        return { minDelay, maxDelay };
    }
    /**
     * Apply random delay between min and max
     */
    async applyDelay(minDelay, maxDelay, phone) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        this.addLog(`Waiting ${Math.round(delay / 1000)}s before sending to ${phone}...`, 'info');
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    /**
     * Substitute template variables in message
     */
    substituteVariables(message, name) {
        if (name) {
            const firstName = name.trim().split(' ')[0];
            return message
                .replace(/{nome_completo}/g, name)
                .replace(/{nome}/g, firstName);
        }
        return message
            .replace(/{nome_completo}/g, 'Visitante')
            .replace(/{nome}/g, 'Visitante');
    }
    /**
     * Handle critical session errors
     */
    async handleCriticalError() {
        this.addLog(`Sessão caiu. Aguardando ${constants_1.QUEUE_CONFIG.SESSION_ERROR_DELAY_MS / 1000}s para reconexão...`, 'error');
        await new Promise(resolve => setTimeout(resolve, constants_1.QUEUE_CONFIG.SESSION_ERROR_DELAY_MS));
    }
    /**
     * Trigger queue automation to send message to next lead
     * Uses dynamic import to avoid circular dependency
     */
    async triggerQueueAutomation() {
        try {
            const { queueAutomationService } = await Promise.resolve().then(() => __importStar(require('../../services/QueueAutomationService')));
            const result = await queueAutomationService.onQueueEmpty();
            if (result.sent) {
                this.addLog(`[Automação] ${result.reason}`, 'success');
            }
            else {
                // Only log if automation is active but couldn't send
                const config = await queueAutomationService.getConfig();
                if (config === null || config === void 0 ? void 0 : config.isActive) {
                    this.addLog(`[Automação] ${result.reason}`, 'info');
                }
            }
        }
        catch (error) {
            logger_1.queueLogger.error('Error triggering queue automation:', error);
        }
    }
    /**
     * Process the queue
     */
    async process() {
        if (this.processing || this.queue.length === 0)
            return;
        this.processing = true;
        // Dynamic import to avoid circular dependency
        const { sendMessage } = await Promise.resolve().then(() => __importStar(require('../whatsapp')));
        while (this.queue.length > 0) {
            const item = this.queue[0];
            item.status = 'processing';
            const { minDelay, maxDelay } = await this.getDelaySettings();
            await this.applyDelay(minDelay, maxDelay, item.phone);
            try {
                // Generate or substitute message
                if (item.isAi) {
                    this.addLog(`Generating AI message for ${item.name || item.phone}...`, 'info');
                    item.message = await this.aiGenerator.generate(item.message, item.name);
                    this.addLog(`AI Message generated: "${item.message.substring(0, 50)}..."`, 'success');
                }
                else {
                    item.message = this.substituteVariables(item.message, item.name);
                }
                // Send message
                this.addLog(`Sending to ${item.phone}...`, 'info');
                await sendMessage(item.phone, item.message);
                // Update stats
                item.status = 'completed';
                this.stats.processed++;
                this.addLog(`Successfully sent to ${item.phone}`, 'success');
                // Record success
                await this.historyRecorder.recordSuccess(item);
                this.queue.shift();
            }
            catch (error) {
                logger_1.queueLogger.error('Error processing item:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                // Handle critical session errors
                if (error instanceof Error && error.message === 'CRITICAL_SESSION_ERROR') {
                    await this.handleCriticalError();
                    continue;
                }
                // Mark as failed
                item.status = 'failed';
                this.stats.failed++;
                this.addLog(`Falha ao enviar para ${item.phone}: ${errorMessage}`, 'error');
                // Record failure
                await this.historyRecorder.recordFailure(item);
                this.queue.shift();
            }
        }
        this.processing = false;
        this.addLog('Queue processing finished.', 'info');
        // Trigger queue automation when queue becomes empty
        await this.triggerQueueAutomation();
    }
}
exports.QueueManager = QueueManager;
