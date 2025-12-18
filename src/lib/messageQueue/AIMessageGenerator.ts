/**
 * AI Message Generator
 * 
 * Responsible for generating messages using OpenAI API.
 * Following SRP: Only handles AI message generation.
 * Following DIP: Depends on ISettingsProvider abstraction.
 */

import type { IAIMessageGenerator, ISettingsProvider } from './interfaces';

interface OpenAIResponse {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
}

export class AIMessageGenerator implements IAIMessageGenerator {
    private systemPrompt: string;

    constructor(
        private settingsProvider: ISettingsProvider,
        systemPrompt?: string
    ) {
        this.systemPrompt = systemPrompt ||
            'Você é um assistente útil e amigável da coordenação do curso de ADS da ULBRA.';
    }

    /**
     * Generate a message using OpenAI
     * @param prompt - The prompt/template to send to AI
     * @param name - Optional recipient name for personalization
     */
    async generate(prompt: string, name?: string): Promise<string> {
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
        } else {
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

        const data = await response.json() as OpenAIResponse;

        if (!response.ok) {
            throw new Error(`OpenAI Error: ${data.error?.message || 'Unknown error'}`);
        }

        const generatedMessage = data.choices?.[0]?.message?.content;
        if (!generatedMessage) {
            throw new Error('OpenAI returned empty response');
        }

        return generatedMessage;
    }
}
