/**
 * Queue Manager
 * 
 * Manages the message queue lifecycle: enqueue, process, clear.
 * Following SRP: Only handles queue management logic.
 * Following DIP: Depends on abstractions for AI generation, history recording, and message sending.
 */

import { QUEUE_CONFIG } from '../constants';
import type {
    QueueItem,
    QueueLog,
    QueueState,
    QueueStats,
    DelaySettings,
    EnqueueOptions
} from './types';
import type {
    IAIMessageGenerator,
    IMessageHistoryRecorder,
    ISettingsProvider
} from './interfaces';

declare global {
    var messageQueueInstance_v9: QueueManager | undefined;
}

export class QueueManager {
    private queue: QueueItem[] = [];
    private processing: boolean = false;
    private logs: QueueLog[] = [];
    private stats: QueueStats = { total: 0, processed: 0, failed: 0 };
    private lastDelaySettings: DelaySettings = { minDelay: 30000, maxDelay: 60000 };

    constructor(
        private aiGenerator: IAIMessageGenerator,
        private historyRecorder: IMessageHistoryRecorder,
        private settingsProvider: ISettingsProvider
    ) { }

    /**
     * Factory method to get singleton instance
     */
    public static getInstance(
        aiGenerator: IAIMessageGenerator,
        historyRecorder: IMessageHistoryRecorder,
        settingsProvider: ISettingsProvider
    ): QueueManager {
        if (!global.messageQueueInstance_v9) {
            global.messageQueueInstance_v9 = new QueueManager(
                aiGenerator,
                historyRecorder,
                settingsProvider
            );
        }
        return global.messageQueueInstance_v9;
    }

    /**
     * Add messages to the queue
     */
    public enqueue(items: EnqueueOptions[]): void {
        const newItems: QueueItem[] = items.map(item => ({
            id: Math.random().toString(36).substring(7),
            phone: item.phone,
            message: item.message,
            name: item.name,
            cpf: item.cpf,
            isAi: item.isAi,
            templateId: item.templateId,
            templateName: item.templateName,
            status: 'pending' as const,
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
    public clear(): void {
        const count = this.queue.length;
        this.queue = [];
        this.stats.total = Math.max(0, this.stats.total - count);
        this.addLog('Queue cleared by user.', 'info');
    }

    /**
     * Add a log entry
     */
    public addLog(message: string, type: 'info' | 'success' | 'error'): void {
        this.logs.unshift({ timestamp: new Date(), message, type });
        if (this.logs.length > QUEUE_CONFIG.MAX_LOGS_COUNT) {
            this.logs.pop();
        }
    }

    /**
     * Get current queue state
     */
    public getState(): QueueState {
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
    private async getDelaySettings(): Promise<DelaySettings> {
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
        } catch (e) {
            console.error('[QueueManager] Error fetching delay settings:', e);
        }

        if (isNaN(minDelay)) minDelay = 30000;
        if (isNaN(maxDelay)) maxDelay = 60000;
        if (maxDelay < minDelay) maxDelay = minDelay;

        this.lastDelaySettings = { minDelay, maxDelay };
        return { minDelay, maxDelay };
    }

    /**
     * Apply random delay between min and max
     */
    private async applyDelay(minDelay: number, maxDelay: number, phone: string): Promise<void> {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        this.addLog(`Waiting ${Math.round(delay / 1000)}s before sending to ${phone}...`, 'info');
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Substitute template variables in message
     */
    private substituteVariables(message: string, name?: string): string {
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
    private async handleCriticalError(): Promise<void> {
        this.addLog(
            `Sessão caiu. Aguardando ${QUEUE_CONFIG.SESSION_ERROR_DELAY_MS / 1000}s para reconexão...`,
            'error'
        );
        await new Promise(resolve => setTimeout(resolve, QUEUE_CONFIG.SESSION_ERROR_DELAY_MS));
    }

    /**
     * Process the queue
     */
    private async process(): Promise<void> {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        // Dynamic import to avoid circular dependency
        const { sendMessage } = await import('../whatsapp');

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
                } else {
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

            } catch (error: unknown) {
                console.error('[QueueManager] Error processing item:', error);
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
    }
}
