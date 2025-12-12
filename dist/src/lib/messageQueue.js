"use strict";
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
exports.messageQueue = void 0;
const constants_1 = require("./constants");
const db_1 = require("./db");
class MessageQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.logs = [];
        this.stats = { total: 0, processed: 0, failed: 0 };
        this.lastDelaySettings = { minDelay: 30000, maxDelay: 60000 };
    }
    static getInstance() {
        if (!global.messageQueueInstance_v8) {
            global.messageQueueInstance_v8 = new MessageQueue();
        }
        return global.messageQueueInstance_v8;
    }
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
    clear() {
        const count = this.queue.length;
        this.queue = [];
        this.stats.total = Math.max(0, this.stats.total - count);
        this.addLog('Queue cleared by user.', 'info');
    }
    addLog(message, type) {
        this.logs.unshift({ timestamp: new Date(), message, type });
        if (this.logs.length > constants_1.QUEUE_CONFIG.MAX_LOGS_COUNT) {
            this.logs.pop();
        }
    }
    async getDelaySettings() {
        let minDelay = 30000;
        let maxDelay = 60000;
        try {
            const result = await db_1.pool.query('SELECT key, value FROM settings WHERE key IN ($1, $2)', ['queue_min_delay', 'queue_max_delay']);
            const rows = result.rows;
            rows.forEach(row => {
                if (row.key === 'queue_min_delay')
                    minDelay = parseInt(row.value) * 1000;
                if (row.key === 'queue_max_delay')
                    maxDelay = parseInt(row.value) * 1000;
            });
        }
        catch (e) {
            console.error('[MessageQueue] Error fetching delay settings:', e);
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
    async applyDelay(minDelay, maxDelay, phone) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        this.addLog(`Waiting ${Math.round(delay / 1000)}s before sending to ${phone}...`, 'info');
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    async generateAIMessage(item) {
        var _a, _b, _c, _d;
        this.addLog(`Generating AI message for ${item.name || item.phone}...`, 'info');
        const result = await db_1.pool.query('SELECT value FROM settings WHERE key = $1', ['openai_api_key']);
        const apiKey = (_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.value;
        if (!apiKey) {
            throw new Error('OpenAI API Key not found');
        }
        let prompt = item.message;
        if (item.name) {
            const firstName = item.name.trim().split(' ')[0];
            prompt = prompt.replace(/{nome_completo}/g, item.name).replace(/{nome}/g, firstName);
        }
        else {
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
        const aiData = await aiRes.json();
        if (!aiRes.ok) {
            throw new Error(`OpenAI Error: ${((_b = aiData.error) === null || _b === void 0 ? void 0 : _b.message) || 'Unknown error'}`);
        }
        const generatedMessage = (_d = (_c = aiData.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content;
        if (!generatedMessage) {
            throw new Error('OpenAI returned empty response');
        }
        this.addLog(`AI Message generated: "${generatedMessage.substring(0, 50)}..."`, 'success');
        return generatedMessage;
    }
    substituteVariables(message, name) {
        if (name) {
            const firstName = name.trim().split(' ')[0];
            return message.replace(/{nome_completo}/g, name).replace(/{nome}/g, firstName);
        }
        return message.replace(/{nome_completo}/g, 'Visitante').replace(/{nome}/g, 'Visitante');
    }
    async recordMessageSuccess(item) {
        if (!item.cpf || !item.templateName)
            return;
        try {
            await db_1.pool.query(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES ($1, $2, $3, $4, 'sent')
            `, [item.cpf, item.templateId || null, item.templateName, item.message]);
            await db_1.pool.query('UPDATE leads SET last_template_name = $1 WHERE cpf = $2', [item.templateName, item.cpf]);
            this.addLog(`Recorded message history for ${item.cpf}`, 'info');
        }
        catch (historyError) {
            console.error('[MessageQueue] Error recording message history:', historyError);
        }
    }
    async recordMessageFailure(item) {
        if (!item.cpf || !item.templateName)
            return;
        try {
            await db_1.pool.query(`
                INSERT INTO message_history (contact_cpf, template_id, template_name, message_content, status)
                VALUES ($1, $2, $3, $4, 'failed')
            `, [item.cpf, item.templateId || null, item.templateName, item.message]);
        }
        catch (historyError) {
            console.error('[MessageQueue] Error recording failed message history:', historyError);
        }
    }
    async handleCriticalError() {
        this.addLog(`Sessão caiu. Aguardando ${constants_1.QUEUE_CONFIG.SESSION_ERROR_DELAY_MS / 1000}s para reconexão...`, 'error');
        await new Promise(resolve => setTimeout(resolve, constants_1.QUEUE_CONFIG.SESSION_ERROR_DELAY_MS));
    }
    async process() {
        if (this.processing || this.queue.length === 0)
            return;
        this.processing = true;
        const { sendMessage } = await Promise.resolve().then(() => __importStar(require('./whatsapp')));
        while (this.queue.length > 0) {
            const item = this.queue[0];
            item.status = 'processing';
            const { minDelay, maxDelay } = await this.getDelaySettings();
            await this.applyDelay(minDelay, maxDelay, item.phone);
            try {
                if (item.isAi) {
                    item.message = await this.generateAIMessage(item);
                }
                else {
                    item.message = this.substituteVariables(item.message, item.name);
                }
                this.addLog(`Sending to ${item.phone}...`, 'info');
                await sendMessage(item.phone, item.message);
                item.status = 'completed';
                this.stats.processed++;
                this.addLog(`Successfully sent to ${item.phone}`, 'success');
                await this.recordMessageSuccess(item);
                this.queue.shift();
            }
            catch (error) {
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
    getState() {
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
exports.messageQueue = MessageQueue.getInstance();
