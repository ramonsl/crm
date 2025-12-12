import { QUEUE_CONFIG } from './constants';
import type { SettingRow, OpenAIResponse } from './types';
import { pool } from './db';

interface QueueItem {
    id: string;
    phone: string;
    message: string;
    name?: string;
    cpf?: string;
    isAi?: boolean;
    templateId?: number;
    templateName?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    addedAt: Date;
}

interface QueueLog {
    timestamp: Date;
    message: string;
    type: 'info' | 'success' | 'error';
}

declare global {
    var messageQueueInstance_v8: MessageQueue | undefined;
}

class MessageQueue {
    private queue: QueueItem[] = [];
    private processing: boolean = false;
    private logs: QueueLog[] = [];
    private stats = { total: 0, processed: 0, failed: 0 };
    private lastDelaySettings = { minDelay: 30000, maxDelay: 60000 };

    private constructor() { }

    public static getInstance(): MessageQueue {
        if (!global.messageQueueInstance_v8) {
            global.messageQueueInstance_v8 = new MessageQueue();
        }
        return global.messageQueueInstance_v8;
    }

    public enqueue(items: {
        phone: string;
        message: string;
        name?: string;
        cpf?: string;
        isAi?: boolean;
        templateId?: number;
        templateName?: string;
    }[]) {
        const newItems = items.map(item => ({
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

    public clear() {
        const count = this.queue.length;
        this.queue = [];
        this.stats.total = Math.max(0, this.stats.total - count);
        this.addLog('Queue cleared by user.', 'info');
    }

    public addLog(message: string, type: 'info' | 'success' | 'error') {
        this.logs.unshift({ timestamp: new Date(), message, type });
        if (this.logs.length > QUEUE_CONFIG.MAX_LOGS_COUNT) {
            this.logs.pop();
        }
    }

    private async getDelaySettings(): Promise<{ minDelay: number; maxDelay: number }> {
        let minDelay = 30000;
        let maxDelay = 60000;

        try {
            const result = await pool.query(
                'SELECT key, value FROM settings WHERE key IN ($1, $2)',
                ['queue_min_delay', 'queue_max_delay']
            );
            const rows = result.rows as SettingRow[];

            rows.forEach(row => {
                if (row.key === 'queue_min_delay') minDelay = parseInt(row.value) * 1000;
                if (row.key === 'queue_max_delay') maxDelay = parseInt(row.value) * 1000;
            });
        } catch (e) {
            console.error('[MessageQueue] Error fetching delay settings:', e);
        }

        if (isNaN(minDelay)) minDelay = 30000;
        if (isNaN(maxDelay)) maxDelay = 60000;
        if (maxDelay < minDelay) maxDelay = minDelay;

        this.lastDelaySettings = { minDelay, maxDelay };
        return { minDelay, maxDelay };
    }

    private async applyDelay(minDelay: number, maxDelay: number, phone: string): Promise<void> {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        this.addLog(`Waiting ${Math.round(delay / 1000)}s before sending to ${phone}...`, 'info');
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    private async generateAIMessage(item: QueueItem): Promise<string> {
        this.addLog(`Generating AI message for ${item.name || item.phone}...`, 'info');

        const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['openai_api_key']);
        const apiKey = result.rows[0]?.value;

        if (!apiKey) {
            throw new Error('OpenAI API Key not found');
        }

        let prompt = item.message;
        if (item.name) {
            const firstName = item.name.trim().split(' ')[0];
            prompt = prompt.replace(/{nome_completo}/g, item.name).replace(/{nome}/g, firstName);
        } else {
            prompt = prompt.replace(/{nome_completo}/g, 'Visitante').replace(/{nome}/g, 'Visitante');
        }

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Você é um assistente útil e amigável da coordenação do curso de ADS da ULBRA.' },
                    { role: 'user', content: prompt }
                ]
            })
        });

        const aiData = await aiRes.json() as OpenAIResponse;
        if (!aiRes.ok) {
            throw new Error(`OpenAI Error: ${aiData.error?.message || 'Unknown error'}`);
        }

        const generatedMessage = aiData.choices[0]?.message?.content;
        if (!generatedMessage) {
            throw new Error('OpenAI returned empty response');
        }

        this.addLog(`AI Message generated: "${generatedMessage.substring(0, 50)}..."`, 'success');
        return generatedMessage;
    }

    private substituteVariables(message: string, name?: string): string {
        if (name) {
            const firstName = name.trim().split(' ')[0];
            return message.replace(/{nome_completo}/g, name).replace(/{nome}/g, firstName);
        }
        return message.replace(/{nome_completo}/g, 'Visitante').replace(/{nome}/g, 'Visitante');
    }

    private async recordMessageSuccess(item: QueueItem): Promise<void> {
        if (!item.cpf || !item.templateName) return;

        try {
            await pool.query(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES ($1, $2, $3, $4, 'sent')
            `, [item.cpf, item.templateId || null, item.templateName, item.message]);

            await pool.query('UPDATE leads SET last_template_name = $1 WHERE cpf = $2', [item.templateName, item.cpf]);
            this.addLog(`Recorded message history for ${item.cpf}`, 'info');
        } catch (historyError) {
            console.error('[MessageQueue] Error recording message history:', historyError);
        }
    }

    private async recordMessageFailure(item: QueueItem): Promise<void> {
        if (!item.cpf || !item.templateName) return;

        try {
            await pool.query(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES ($1, $2, $3, $4, 'failed')
            `, [item.cpf, item.templateId || null, item.templateName, item.message]);
        } catch (historyError) {
            console.error('[MessageQueue] Error recording failed message history:', historyError);
        }
    }

    private async handleCriticalError(): Promise<void> {
        this.addLog(`Sessão caiu. Aguardando ${QUEUE_CONFIG.SESSION_ERROR_DELAY_MS / 1000}s para reconexão...`, 'error');
        await new Promise(resolve => setTimeout(resolve, QUEUE_CONFIG.SESSION_ERROR_DELAY_MS));
    }

    private async process() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        const { sendMessage } = await import('./whatsapp');

        while (this.queue.length > 0) {
            const item = this.queue[0];
            item.status = 'processing';

            const { minDelay, maxDelay } = await this.getDelaySettings();
            await this.applyDelay(minDelay, maxDelay, item.phone);

            try {
                if (item.isAi) {
                    item.message = await this.generateAIMessage(item);
                } else {
                    item.message = this.substituteVariables(item.message, item.name);
                }

                this.addLog(`Sending to ${item.phone}...`, 'info');
                await sendMessage(item.phone, item.message);

                item.status = 'completed';
                this.stats.processed++;
                this.addLog(`Successfully sent to ${item.phone}`, 'success');

                await this.recordMessageSuccess(item);
                this.queue.shift();

            } catch (error: unknown) {
                console.error('[MessageQueue] Error processing item:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                if (error instanceof Error && error.message === 'CRITICAL_SESSION_ERROR') {
                    await this.handleCriticalError();
                    continue;
                }

                item.status = 'failed';
                this.stats.failed++;
                this.addLog(`Falha ao enviar para ${item.phone}: ${errorMessage}`, 'error');

                await this.recordMessageFailure(item);
                this.queue.shift();
            }
        }

        this.processing = false;
        this.addLog('Queue processing finished.', 'info');
    }

    public getState() {
        const remainingMessages = this.queue.length;
        const averageDelay = (this.lastDelaySettings.minDelay + this.lastDelaySettings.maxDelay) / 2;
        const estimatedTimeSeconds = remainingMessages > 0 ? Math.round((remainingMessages * averageDelay) / 1000) : 0;

        return {
            queueLength: this.queue.length,
            processing: this.processing,
            logs: this.logs,
            stats: this.stats,
            currentItem: this.queue[0] || null,
            estimatedTimeRemaining: estimatedTimeSeconds
        };
    }
}

export const messageQueue = MessageQueue.getInstance();
