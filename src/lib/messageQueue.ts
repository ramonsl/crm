import { QUEUE_CONFIG } from './constants';
import type { DatabaseInstance, SettingRow, OpenAIResponse, StandardError, getErrorMessage } from './types';

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

// Define global type for persistence
declare global {
    var messageQueueInstance_v8: MessageQueue | undefined;
}

class MessageQueue {
    private queue: QueueItem[] = [];
    private processing: boolean = false;
    private logs: QueueLog[] = [];
    private stats = {
        total: 0,
        processed: 0,
        failed: 0
    };

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
        this.logs.unshift({
            timestamp: new Date(),
            message,
            type
        });
        // Keep last N logs
        if (this.logs.length > QUEUE_CONFIG.MAX_LOGS_COUNT) {
            this.logs.pop();
        }
    }

    /**
     * Fetches delay settings from database
     * @returns Object with minDelay and maxDelay in milliseconds
     */
    private async getDelaySettings(db: DatabaseInstance): Promise<{ minDelay: number; maxDelay: number }> {
        let minDelay = 30000;
        let maxDelay = 60000;

        try {
            const stmt = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?)');
            const rows = stmt.all('queue_min_delay', 'queue_max_delay') as SettingRow[];

            rows.forEach(row => {
                if (row.key === 'queue_min_delay') minDelay = parseInt(row.value) * 1000;
                if (row.key === 'queue_max_delay') maxDelay = parseInt(row.value) * 1000;
            });
        } catch (e) {
            console.error('[MessageQueue] Error fetching delay settings:', e);
        }

        // Ensure valid range
        if (isNaN(minDelay)) minDelay = 30000;
        if (isNaN(maxDelay)) maxDelay = 60000;
        if (maxDelay < minDelay) maxDelay = minDelay;

        return { minDelay, maxDelay };
    }

    /**
     * Applies random delay between messages
     */
    private async applyDelay(minDelay: number, maxDelay: number, phone: string): Promise<void> {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        this.addLog(`Waiting ${Math.round(delay / 1000)}s before sending to ${phone}...`, 'info');
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Generates AI message using OpenAI
     */
    private async generateAIMessage(item: QueueItem, db: DatabaseInstance): Promise<string> {
        this.addLog(`Generating AI message for ${item.name || item.phone}...`, 'info');

        const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
        const apiKey = (stmt.get('openai_api_key') as SettingRow | undefined)?.value;

        if (!apiKey) {
            throw new Error('OpenAI API Key not found');
        }

        // Substitute variables in prompt
        let prompt = item.message;
        if (item.name) {
            const firstName = item.name.trim().split(' ')[0];
            prompt = prompt
                .replace(/{nome_completo}/g, item.name)
                .replace(/{nome}/g, firstName);
        } else {
            prompt = prompt
                .replace(/{nome_completo}/g, 'Visitante')
                .replace(/{nome}/g, 'Visitante');
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

    /**
     * Substitutes variables in message template
     */
    private substituteVariables(message: string, name?: string): string {
        if (name) {
            const firstName = name.trim().split(' ')[0]; // Extrai primeiro nome
            return message
                .replace(/{nome_completo}/g, name) // Nome completo
                .replace(/{nome}/g, firstName);     // Apenas primeiro nome
        } else {
            return message
                .replace(/{nome_completo}/g, 'Visitante')
                .replace(/{nome}/g, 'Visitante');
        }
    }

    /**
     * Records successful message in history
     */
    private recordMessageSuccess(item: QueueItem, db: DatabaseInstance): void {
        if (!item.cpf || !item.templateName) return;

        try {
            const insertHistory = db.prepare(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES (?, ?, ?, ?, 'sent')
            `);
            insertHistory.run(item.cpf, item.templateId || null, item.templateName, item.message);

            // Update last_template_name on contact
            const updateLead = db.prepare(`
                UPDATE leads SET last_template_name = ? WHERE cpf = ?
            `);
            updateLead.run(item.templateName, item.cpf);

            this.addLog(`Recorded message history for ${item.cpf}`, 'info');
        } catch (historyError) {
            console.error('[MessageQueue] Error recording message history:', historyError);
            // Don't fail the whole process if history recording fails
        }
    }

    /**
     * Records failed message in history
     */
    private recordMessageFailure(item: QueueItem, db: DatabaseInstance): void {
        if (!item.cpf || !item.templateName) return;

        try {
            const insertHistory = db.prepare(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES (?, ?, ?, ?, 'failed')
            `);
            insertHistory.run(item.cpf, item.templateId || null, item.templateName, item.message);
        } catch (historyError) {
            console.error('[MessageQueue] Error recording failed message history:', historyError);
        }
    }

    /**
     * Handles critical session errors
     */
    private async handleCriticalError(): Promise<void> {
        this.addLog(`Sessão caiu. Aguardando ${QUEUE_CONFIG.SESSION_ERROR_DELAY_MS / 1000}s para reconexão...`, 'error');
        await new Promise(resolve => setTimeout(resolve, QUEUE_CONFIG.SESSION_ERROR_DELAY_MS));
    }

    /**
     * Processes the message queue
     * Main orchestration method - delegates to smaller focused methods
     */
    private async process() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        // Dynamic import to avoid circular dependency
        const { sendMessage } = await import('./whatsapp');
        const db = (await import('./db')).default;

        while (this.queue.length > 0) {
            const item = this.queue[0]; // Peek
            item.status = 'processing';

            // Get delay settings
            const { minDelay, maxDelay } = await this.getDelaySettings(db);

            // Apply delay
            await this.applyDelay(minDelay, maxDelay, item.phone);

            try {
                // Generate or substitute message
                if (item.isAi) {
                    item.message = await this.generateAIMessage(item, db);
                } else {
                    item.message = this.substituteVariables(item.message, item.name);
                }

                // Send message
                this.addLog(`Sending to ${item.phone}...`, 'info');
                console.log(`[MessageQueue] About to call sendMessage with phone: "${item.phone}" (type: ${typeof item.phone}, length: ${item.phone.length})`);
                await sendMessage(item.phone, item.message);

                // Mark as completed
                item.status = 'completed';
                this.stats.processed++;
                this.addLog(`Successfully sent to ${item.phone}`, 'success');

                // Record success in history
                this.recordMessageSuccess(item, db);

                // Remove from queue only if successful
                this.queue.shift();

            } catch (error: unknown) {
                console.error('[MessageQueue] Error processing item:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                // Handle critical session errors
                if (error instanceof Error && error.message === 'CRITICAL_SESSION_ERROR') {
                    await this.handleCriticalError();
                    // Continue loop to retry this item (don't shift)
                    continue;
                }

                // Mark as failed
                item.status = 'failed';
                this.stats.failed++;
                this.addLog(`Failed to send to ${item.phone}: ${errorMessage}`, 'error');

                // Record failure in history
                this.recordMessageFailure(item, db);

                // Remove failed item (non-critical error)
                this.queue.shift();
            }
        }

        this.processing = false;
        this.addLog('Queue processing finished.', 'info');
    }

    public getState() {
        return {
            queueLength: this.queue.length,
            processing: this.processing,
            logs: this.logs,
            stats: this.stats,
            currentItem: this.queue[0] || null
        };
    }
}

export const messageQueue = MessageQueue.getInstance();
