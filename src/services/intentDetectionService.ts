/**
 * Intent Detection Service
 * Uses OpenAI to detect user intent from messages
 */

import type { AutoReply, IntentDetectionResult } from '@/types/autoReply';

// Simple in-memory cache to avoid redundant API calls
const intentCache = new Map<string, IntentDetectionResult>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

interface CacheEntry {
    result: IntentDetectionResult;
    timestamp: number;
}

export class IntentDetectionService {
    private cacheStore = new Map<string, CacheEntry>();

    /**
     * Detect intent from a message using OpenAI
     */
    async detectIntent(
        message: string,
        availableIntents: AutoReply[]
    ): Promise<IntentDetectionResult | null> {
        // Check cache first
        const cacheKey = this.getCacheKey(message, availableIntents);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log('[IntentDetection] Cache hit for message:', message.substring(0, 50));
            return cached;
        }

        if (availableIntents.length === 0) {
            console.log('[IntentDetection] No active intents available');
            return null;
        }

        try {
            const result = await this.callOpenAI(message, availableIntents);

            if (result) {
                this.saveToCache(cacheKey, result);
            }

            return result;
        } catch (error) {
            console.error('[IntentDetection] Error detecting intent:', error);
            return null;
        }
    }

    /**
     * Call OpenAI API to detect intent
     */
    private async callOpenAI(
        message: string,
        availableIntents: AutoReply[]
    ): Promise<IntentDetectionResult | null> {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            console.error('[IntentDetection] OPENAI_API_KEY not set');
            return null;
        }

        // Build the prompt with available intents
        const intentsList = availableIntents.map((intent, idx) =>
            `${idx + 1}. **${intent.name}**: ${intent.intent_description}${intent.example_messages.length > 0
                ? `\n   Exemplos: ${intent.example_messages.slice(0, 3).join(', ')}`
                : ''
            }`
        ).join('\n\n');

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
            console.log('[IntentDetection] Calling OpenAI API...');

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
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                console.error('[IntentDetection] Empty response from OpenAI');
                return null;
            }

            const parsed = JSON.parse(content);

            // Find the matching intent from available intents
            const matchedIntent = availableIntents.find(
                intent => intent.name.toLowerCase() === parsed.intent.toLowerCase()
            );

            if (!matchedIntent) {
                console.log('[IntentDetection] Intent not found in available intents:', parsed.intent);
                return null;
            }

            console.log('[IntentDetection] Detected intent:', {
                intent: matchedIntent.name,
                confidence: parsed.confidence
            });

            return {
                intent: matchedIntent.name,
                confidence: parsed.confidence,
                autoReplyId: matchedIntent.id
            };
        } catch (error) {
            console.error('[IntentDetection] OpenAI API call failed:', error);
            throw error;
        }
    }

    /**
     * Generate cache key
     */
    private getCacheKey(message: string, intents: AutoReply[]): string {
        const intentIds = intents.map(i => i.id).sort().join(',');
        return `${message.toLowerCase().trim()}|${intentIds}`;
    }

    /**
     * Get from cache
     */
    private getFromCache(key: string): IntentDetectionResult | null {
        const entry = this.cacheStore.get(key);
        if (!entry) return null;

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
    private saveToCache(key: string, result: IntentDetectionResult): void {
        this.cacheStore.set(key, {
            result,
            timestamp: Date.now()
        });

        // Cleanup old entries (simple LRU)
        if (this.cacheStore.size > 1000) {
            const oldestKey = this.cacheStore.keys().next().value;
            this.cacheStore.delete(oldestKey);
        }
    }

    /**
     * Clear cache (useful for testing)
     */
    clearCache(): void {
        this.cacheStore.clear();
    }
}

export const intentDetectionService = new IntentDetectionService();
