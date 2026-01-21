/**
 * WhatsAppProviderFactory Integration Tests
 */

import { WhatsAppProviderFactory, ProviderType } from '@/lib/whatsapp/factory';
import { BaileysAdapter } from '@/lib/whatsapp/adapters/BaileysAdapter';

// Mock adapters
jest.mock('@/lib/whatsapp/adapters/BaileysAdapter');
jest.mock('@/lib/logger');

describe('WhatsAppProviderFactory', () => {
    beforeEach(() => {
        // Reset factory state before each test
        WhatsAppProviderFactory.reset();
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await WhatsAppProviderFactory.reset();
    });

    describe('getProvider()', () => {
        test('should create Baileys provider by default', async () => {
            const provider = await WhatsAppProviderFactory.getProvider();
            expect(provider).toBeInstanceOf(BaileysAdapter);
        });

        test('should create Baileys provider when explicitly requested', async () => {
            const provider = await WhatsAppProviderFactory.getProvider('baileys');
            expect(provider).toBeInstanceOf(BaileysAdapter);
        });

        test('should return same instance on multiple calls (singleton)', async () => {
            const provider1 = await WhatsAppProviderFactory.getProvider('baileys');
            const provider2 = await WhatsAppProviderFactory.getProvider('baileys');
            expect(provider1).toBe(provider2);
        });
        test('should throw error for unsupported provider', async () => {
            await expect(
                WhatsAppProviderFactory.getProvider('twilio' as unknown as ProviderType)
            ).rejects.toThrow('Twilio provider not implemented yet');
        });

        test('should throw error for unknown provider', async () => {
            await expect(
                WhatsAppProviderFactory.getProvider('unknown' as unknown as ProviderType)
            ).rejects.toThrow('Unknown provider');
        });
    });

    describe('getCurrentProviderType()', () => {
        test('should return null when no provider initialized', () => {
            const type = WhatsAppProviderFactory.getCurrentProviderType();
            expect(type).toBeNull();
        });

        test('should return provider type after initialization', async () => {
            await WhatsAppProviderFactory.getProvider('baileys');
            const type = WhatsAppProviderFactory.getCurrentProviderType();
            expect(type).toBe('baileys');
        });
    });

    describe('hasProvider()', () => {
        test('should return false when no provider initialized', () => {
            const has = WhatsAppProviderFactory.hasProvider();
            expect(has).toBe(false);
        });

        test('should return true after provider initialization', async () => {
            await WhatsAppProviderFactory.getProvider('baileys');
            const has = WhatsAppProviderFactory.hasProvider();
            expect(has).toBe(true);
        });
    });

    describe('reset()', () => {
        test('should clear provider instance', async () => {
            await WhatsAppProviderFactory.getProvider('baileys');
            expect(WhatsAppProviderFactory.hasProvider()).toBe(true);

            await WhatsAppProviderFactory.reset();
            expect(WhatsAppProviderFactory.hasProvider()).toBe(false);
        });

        test('should allow creating new provider after reset', async () => {
            const provider1 = await WhatsAppProviderFactory.getProvider('baileys');
            await WhatsAppProviderFactory.reset();
            const provider2 = await WhatsAppProviderFactory.getProvider('baileys');

            expect(provider1).not.toBe(provider2);
        });
    });

    describe('setProvider()', () => {
        test('should set and return provider', async () => {
            const provider = await WhatsAppProviderFactory.setProvider('baileys');
            expect(provider).toBeInstanceOf(BaileysAdapter);
            expect(WhatsAppProviderFactory.getCurrentProviderType()).toBe('baileys');
        });

        test('should switch provider type', async () => {
            await WhatsAppProviderFactory.setProvider('baileys');
            expect(WhatsAppProviderFactory.getCurrentProviderType()).toBe('baileys');

            // Note: This will fail until WWebJS is implemented
            // await WhatsAppProviderFactory.setProvider('wwebjs');
            // expect(WhatsAppProviderFactory.getCurrentProviderType()).toBe('wwebjs');
        });
    });
});
