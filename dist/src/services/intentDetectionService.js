"use strict";
/**
 * Intent Detection Service
 * Uses OpenAI to detect user intent from messages
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.intentDetectionService = exports.IntentDetectionService = void 0;
const logger_1 = require("../lib/logger");
// Cache TTL configuration
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes
class IntentDetectionService {
    constructor() {
        this.cacheStore = new Map();
    }
    /**
     * Detect intent from a message using OpenAI
     */
    async detectIntent(message, availableIntents) {
        // Check cache first
        const cacheKey = this.getCacheKey(message, availableIntents);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            logger_1.logger.debug(`[IntentDetection] Cache hit for message: ${message.substring(0, 50)}`);
            return cached;
        }
        if (availableIntents.length === 0) {
            logger_1.logger.debug('[IntentDetection] No active intents available');
            return null;
        }
        try {
            const result = await this.callOpenAI(message, availableIntents);
            if (result) {
                this.saveToCache(cacheKey, result);
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('[IntentDetection] Error detecting intent:', error);
            return null;
        }
    }
    /**
     * Call OpenAI API to detect intent
     */
    async callOpenAI(message, availableIntents) {
        var _a, _b, _c;
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            logger_1.logger.error('[IntentDetection] OPENAI_API_KEY not set');
            return null;
        }
        // Build the prompt with available intents
        const intentsList = availableIntents.map((intent, idx) => `${idx + 1}. **${intent.name}**: ${intent.intent_description}${intent.example_messages.length > 0
            ? `\n   Exemplos: ${intent.example_messages.slice(0, 3).join(', ')}`
            : ''}`).join('\n\n');
        const systemPrompt = `Você é um classificador de intenções para mensagens de WhatsApp.
Analise a mensagem do usuário e identifique qual intenção melhor se encaixa.

Intenções disponíveis:
${intentsList}

IMPORTANTE:
- Retorne apenas o NOME EXATO da intenção que melhor corresponde
- Inclua um valor de confiança entre 0.0 e 1.0
- Se nenhuma intenção se encaixar bem, retorne confiança baixa (< 0.5)
- Seja preciso e objetivo`;
        const userPrompt = `Mensagem do usuário: "${message}"

Qual intenção melhor corresponde a esta mensagem?
Responda em JSON no formato:
{
  "intent": "Nome da Intenção",
  "confidence": 0.95
}`;
        try {
            logger_1.logger.debug('[IntentDetection] Calling OpenAI API...');
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini', // Using cheaper model for intent classification
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.3, // Low temperature for consistent classification
                    max_tokens: 150,
                    response_format: { type: 'json_object' }
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            const content = (_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content;
            if (!content) {
                logger_1.logger.error('[IntentDetection] Empty response from OpenAI');
                return null;
            }
            const parsed = JSON.parse(content);
            // Find the matching intent from available intents
            const matchedIntent = availableIntents.find(intent => intent.name.toLowerCase() === parsed.intent.toLowerCase());
            if (!matchedIntent) {
                logger_1.logger.debug(`[IntentDetection] Intent not found in available intents: ${parsed.intent}`);
                return null;
            }
            logger_1.logger.debug('[IntentDetection] Detected intent:', {
                intent: matchedIntent.name,
                confidence: parsed.confidence
            });
            return {
                intent: matchedIntent.name,
                confidence: parsed.confidence,
                autoReplyId: matchedIntent.id
            };
        }
        catch (error) {
            logger_1.logger.error('[IntentDetection] OpenAI API call failed:', error);
            throw error;
        }
    }
    /**
     * Generate cache key
     */
    getCacheKey(message, intents) {
        const intentIds = intents.map(i => i.id).sort().join(',');
        return `${message.toLowerCase().trim()}|${intentIds}`;
    }
    /**
     * Get from cache
     */
    getFromCache(key) {
        const entry = this.cacheStore.get(key);
        if (!entry)
            return null;
        // Check if cache entry is still valid
        if (Date.now() - entry.timestamp > CACHE_TTL) {
            this.cacheStore.delete(key);
            return null;
        }
        return entry.result;
    }
    /**
     * Save to cache
     */
    saveToCache(key, result) {
        this.cacheStore.set(key, {
            result,
            timestamp: Date.now()
        });
        // Cleanup old entries (simple LRU)
        if (this.cacheStore.size > 1000) {
            const oldestKey = this.cacheStore.keys().next().value;
            if (oldestKey !== undefined) {
                this.cacheStore.delete(oldestKey);
            }
        }
    }
    /**
     * Clear cache (useful for testing)
     */
    clearCache() {
        this.cacheStore.clear();
    }
}
exports.IntentDetectionService = IntentDetectionService;
exports.intentDetectionService = new IntentDetectionService();
