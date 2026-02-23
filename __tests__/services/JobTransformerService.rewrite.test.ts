/**
 * Unit tests for JobTransformerService.rewriteForwardedJobText
 * Tests the new method that cleans propaganda and rewrites forwarded job descriptions.
 */

import { JobTransformerService } from '@/services/JobTransformerService';

// Mock OpenAI
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn(),
            },
        },
    }));
});

const mockOpenAICreate = jest.fn();

// Mock the OpenAI constructor to return our spy
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        chat: { completions: { create: mockOpenAICreate } },
    }));
});

function buildGPTResponse(body: object): object {
    return {
        choices: [{ message: { content: JSON.stringify(body) } }],
    };
}

describe('JobTransformerService.rewriteForwardedJobText', () => {
    let service: JobTransformerService;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.OPENAI_API_KEY = 'test-key';
        service = new JobTransformerService();
    });

    it('returns isJob=false and null message when GPT says it is not a job', async () => {
        mockOpenAICreate.mockResolvedValueOnce(
            buildGPTResponse({ isJob: false, formattedMessage: null, applicationLink: null })
        );

        const result = await service.rewriteForwardedJobText('Olá, tudo bem? Como você está hoje?');
        expect(result.isJob).toBe(false);
        expect(result.formattedMessage).toBeNull();
        expect(result.applicationLink).toBeNull();
    });

    it('returns the rewritten message and application link when it is a valid job', async () => {
        const fakeMessage = '🚀 *NOVA OPORTUNIDADE!*\n\n💼 *Cargo:* Dev React\n...';
        mockOpenAICreate.mockResolvedValueOnce(
            buildGPTResponse({
                isJob: true,
                formattedMessage: fakeMessage,
                applicationLink: 'https://empresa.gupy.io/vagas/123',
            })
        );

        const rawText = `Estamos contratando! Vaga: Desenvolvedor React Pleno
Empresa: TechCorp | Remoto
Requisitos: React, TypeScript
Candidate-se: https://empresa.gupy.io/vagas/123

---
Entre no nosso grupo de vagas: https://chat.whatsapp.com/spam123
Siga nosso canal no Instagram @vagas_consultoria`;

        const result = await service.rewriteForwardedJobText(rawText);
        expect(result.isJob).toBe(true);
        expect(result.formattedMessage).toBe(fakeMessage);
        expect(result.applicationLink).toBe('https://empresa.gupy.io/vagas/123');
        expect(mockOpenAICreate).toHaveBeenCalledTimes(1);

        // Validate prompt includes the raw text
        const call = mockOpenAICreate.mock.calls[0][0];
        const userMessage = call.messages.find((m: { role: string }) => m.role === 'user');
        expect(userMessage.content).toContain('TechCorp');
    });

    it('returns isJob=false when OpenAI throws an error', async () => {
        mockOpenAICreate.mockRejectedValueOnce(new Error('API timeout'));

        const result = await service.rewriteForwardedJobText('Vaga de desenvolvedor backend remoto...');
        expect(result.isJob).toBe(false);
        expect(result.formattedMessage).toBeNull();
    });

    it('returns isJob=false and null when GPT returns empty content', async () => {
        mockOpenAICreate.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] });

        const result = await service.rewriteForwardedJobText('Vaga de desenvolvedor...');
        expect(result.isJob).toBe(false);
        expect(result.formattedMessage).toBeNull();
    });
});
