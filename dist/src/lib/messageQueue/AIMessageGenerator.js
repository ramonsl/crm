"use strict";
/**
 * AI Message Generator
 *
 * Responsible for generating messages using OpenAI API.
 * Following SRP: Only handles AI message generation.
 * Following DIP: Depends on ISettingsProvider abstraction.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIMessageGenerator = void 0;
class AIMessageGenerator {
    constructor(settingsProvider, systemPrompt) {
        this.settingsProvider = settingsProvider;
        this.systemPrompt = systemPrompt ||
            'Você é um assistente útil e amigável da coordenação do curso de ADS da ULBRA.';
    }
    /**
     * Generate a message using OpenAI
     * @param prompt - The prompt/template to send to AI
     * @param name - Optional recipient name for personalization
     */
    async generate(prompt, name) {
        var _a, _b, _c, _d;
        const apiKey = await this.settingsProvider.get('openai_api_key');
        if (!apiKey) {
            throw new Error('OpenAI API Key not found');
        }
        // Substitute variables in prompt
        let processedPrompt = prompt;
        if (name) {
            const firstName = name.trim().split(' ')[0];
            processedPrompt = processedPrompt
                .replace(/{nome_completo}/g, name)
                .replace(/{nome}/g, firstName);
        }
        else {
            processedPrompt = processedPrompt
                .replace(/{nome_completo}/g, 'Visitante')
                .replace(/{nome}/g, 'Visitante');
        }
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: this.systemPrompt },
                    { role: 'user', content: processedPrompt }
                ]
            })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(`OpenAI Error: ${((_a = data.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'}`);
        }
        const generatedMessage = (_d = (_c = (_b = data.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content;
        if (!generatedMessage) {
            throw new Error('OpenAI returned empty response');
        }
        return generatedMessage;
    }
}
exports.AIMessageGenerator = AIMessageGenerator;
