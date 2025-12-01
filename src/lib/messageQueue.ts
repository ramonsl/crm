interface QueueItem {
    id: string;
    phone: string;
    message: string;
    name?: string;
    isAi?: boolean;
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

    public enqueue(items: { phone: string; message: string; name?: string; isAi?: boolean }[]) {
        const newItems = items.map(item => ({
            id: Math.random().toString(36).substring(7),
            phone: item.phone,
            message: item.message,
            name: item.name,
            isAi: item.isAi,
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
        // Keep last 100 logs
        if (this.logs.length > 100) {
            this.logs.pop();
        }
    }

    private async process() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        // Dynamic import to avoid circular dependency
        const { sendMessage } = await import('./whatsapp');
        const db = (await import('./db')).default;

        while (this.queue.length > 0) {
            const item = this.queue[0]; // Peek
            item.status = 'processing';

            // Fetch delay settings
            let minDelay = 30000;
            let maxDelay = 60000;

            try {
                const stmt = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?)');
                const rows = stmt.all('queue_min_delay', 'queue_max_delay') as { key: string; value: string }[];

                rows.forEach(row => {
                    if (row.key === 'queue_min_delay') minDelay = parseInt(row.value) * 1000;
                    if (row.key === 'queue_max_delay') maxDelay = parseInt(row.value) * 1000;
                });
            } catch (e) {
                console.error('Error fetching delay settings:', e);
            }

            // Ensure valid range
            if (isNaN(minDelay)) minDelay = 30000;
            if (isNaN(maxDelay)) maxDelay = 60000;
            if (maxDelay < minDelay) maxDelay = minDelay;

            // Random delay
            const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
            this.addLog(`Waiting ${Math.round(delay / 1000)}s before sending to ${item.phone}...`, 'info');

            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                // AI Generation Logic
                if (item.isAi) {
                    this.addLog(`Generating AI message for ${item.name || item.phone}...`, 'info');

                    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
                    const apiKey = (stmt.get('openai_api_key') as { value: string } | undefined)?.value;

                    if (!apiKey) {
                        throw new Error('OpenAI API Key not found');
                    }

                    // Substitute variable in prompt
                    let prompt = item.message;
                    if (item.name) {
                        prompt = prompt.replace(/{nome}/g, item.name);
                    } else {
                        prompt = prompt.replace(/{nome}/g, 'Visitante');
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

                    const aiData = await aiRes.json();
                    if (!aiRes.ok) {
                        throw new Error(`OpenAI Error: ${aiData.error?.message || 'Unknown error'}`);
                    }

                    const generatedMessage = aiData.choices[0]?.message?.content;
                    if (!generatedMessage) {
                        throw new Error('OpenAI returned empty response');
                    }

                    item.message = generatedMessage;
                    this.addLog(`AI Message generated: "${generatedMessage.substring(0, 50)}..."`, 'success');
                } else {
                    // Regular substitution for non-AI messages (if not already done)
                    if (item.name) {
                        item.message = item.message.replace(/{nome}/g, item.name);
                    } else {
                        item.message = item.message.replace(/{nome}/g, 'Visitante');
                    }
                }

                this.addLog(`Sending to ${item.phone}...`, 'info');
                console.log(`[MessageQueue] About to call sendMessage with phone: "${item.phone}" (type: ${typeof item.phone}, length: ${item.phone.length})`);
                await sendMessage(item.phone, item.message);

                item.status = 'completed';
                this.stats.processed++;
                this.addLog(`Successfully sent to ${item.phone}`, 'success');

                // Only remove from queue if successful
                this.queue.shift();
            } catch (error: any) {
                console.error(error);

                if (error.message === 'CRITICAL_SESSION_ERROR') {
                    this.addLog(`Sessão caiu. Aguardando 30s para reconexão...`, 'error');
                    // Do NOT remove from queue.
                    // Wait 30 seconds for restart
                    await new Promise(resolve => setTimeout(resolve, 30000));
                    // Continue loop, which will retry this item (since we didn't shift)
                    continue;
                }

                item.status = 'failed';
                this.stats.failed++;
                this.addLog(`Failed to send to ${item.phone}: ${error.message}`, 'error');
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
