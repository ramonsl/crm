/**
 * AIMessageGenerator Tests
 * 
 * Tests for the AI message generation component.
 */

import { AIMessageGenerator } from '@/lib/messageQueue/AIMessageGenerator';
import type { ISettingsProvider } from '@/lib/messageQueue/interfaces';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AIMessageGenerator', () => {
    let generator: AIMessageGenerator;
    let mockSettingsProvider: jest.Mocked<ISettingsProvider>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock settings provider
        mockSettingsProvider = {
            get: jest.fn(),
            getMultiple: jest.fn()
        };

        generator = new AIMessageGenerator(mockSettingsProvider);
    });

    describe('generate()', () => {
        it('should throw error when API key is not found', async () => {
            mockSettingsProvider.get.mockResolvedValue(null);

            await expect(generator.generate('Hello {nome}')).rejects.toThrow('OpenAI API Key not found');
            expect(mockSettingsProvider.get).toHaveBeenCalledWith('openai_api_key');
        });

        it('should generate message successfully', async () => {
            mockSettingsProvider.get.mockResolvedValue('sk-test-key');
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'Generated message' } }]
                })
            });

            const result = await generator.generate('Hello {nome}', 'John Doe');

            expect(result).toBe('Generated message');
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.openai.com/v1/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer sk-test-key'
                    })
                })
            );
        });

        it('should substitute {nome} with first name', async () => {
            mockSettingsProvider.get.mockResolvedValue('sk-test-key');
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'OK' } }]
                })
            });

            await generator.generate('Olá {nome}, como vai?', 'João Silva');

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.messages[1].content).toBe('Olá João, como vai?');
        });

        it('should substitute {nome_completo} with full name', async () => {
            mockSettingsProvider.get.mockResolvedValue('sk-test-key');
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'OK' } }]
                })
            });

            await generator.generate('Olá {nome_completo}!', 'João Silva');

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.messages[1].content).toBe('Olá João Silva!');
        });

        it('should use "Visitante" when name is not provided', async () => {
            mockSettingsProvider.get.mockResolvedValue('sk-test-key');
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'OK' } }]
                })
            });

            await generator.generate('Olá {nome}!');

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.messages[1].content).toBe('Olá Visitante!');
        });

        it('should throw error when OpenAI returns error', async () => {
            mockSettingsProvider.get.mockResolvedValue('sk-test-key');
            mockFetch.mockResolvedValue({
                ok: false,
                json: async () => ({
                    error: { message: 'Rate limit exceeded' }
                })
            });

            await expect(generator.generate('Hello')).rejects.toThrow('OpenAI Error: Rate limit exceeded');
        });

        it('should throw error when OpenAI returns empty response', async () => {
            mockSettingsProvider.get.mockResolvedValue('sk-test-key');
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: []
                })
            });

            await expect(generator.generate('Hello')).rejects.toThrow('OpenAI returned empty response');
        });
    });

    describe('constructor', () => {
        it('should use custom system prompt when provided', async () => {
            const customPrompt = 'You are a helpful assistant.';
            const customGenerator = new AIMessageGenerator(mockSettingsProvider, customPrompt);

            mockSettingsProvider.get.mockResolvedValue('sk-test-key');
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'OK' } }]
                })
            });

            await customGenerator.generate('Hello');

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.messages[0].content).toBe(customPrompt);
        });
    });
});
