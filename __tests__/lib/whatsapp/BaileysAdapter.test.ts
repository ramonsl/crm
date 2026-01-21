/**
 * BaileysAdapter Unit Tests
 * 
 * Tests for the Baileys WhatsApp provider adapter
 */

import { BaileysAdapter } from '@/lib/whatsapp/adapters/BaileysAdapter';
// WhatsAppMessage import removed (unused)

// Mock dependencies
jest.mock('@whiskeysockets/baileys');
jest.mock('@/lib/logger');
jest.mock('@/lib/messageQueue');
jest.mock('@/lib/socket/emitter');

describe('BaileysAdapter', () => {
    let adapter: BaileysAdapter;

    beforeEach(() => {
        adapter = new BaileysAdapter();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Lifecycle Methods', () => {
        test('should implement initialize()', () => {
            expect(adapter.initialize).toBeDefined();
            expect(typeof adapter.initialize).toBe('function');
        });

        test('should implement restart()', () => {
            expect(adapter.restart).toBeDefined();
            expect(typeof adapter.restart).toBe('function');
        });

        test('should implement logout()', () => {
            expect(adapter.logout).toBeDefined();
            expect(typeof adapter.logout).toBe('function');
        });

        test('should implement clearSession()', () => {
            expect(adapter.clearSession).toBeDefined();
            expect(typeof adapter.clearSession).toBe('function');
        });
    });

    describe('Status & Connection Methods', () => {
        test('should implement getStatus()', async () => {
            const status = await adapter.getStatus();
            expect(status).toHaveProperty('status');
            expect(['connecting', 'ready', 'qr', 'disconnected']).toContain(status.status);
        });

        test('should implement isReady()', async () => {
            const isReady = await adapter.isReady();
            expect(typeof isReady).toBe('boolean');
        });

        test('should return false for isReady() when not connected', async () => {
            const isReady = await adapter.isReady();
            expect(isReady).toBe(false);
        });
    });

    describe('Messaging Methods', () => {
        test('should implement sendTextMessage()', () => {
            expect(adapter.sendTextMessage).toBeDefined();
            expect(typeof adapter.sendTextMessage).toBe('function');
        });

        test('should implement sendImage()', () => {
            expect(adapter.sendImage).toBeDefined();
            expect(typeof adapter.sendImage).toBe('function');
        });

        test('should implement sendVideo()', () => {
            expect(adapter.sendVideo).toBeDefined();
            expect(typeof adapter.sendVideo).toBe('function');
        });

        test('should implement sendAudio()', () => {
            expect(adapter.sendAudio).toBeDefined();
            expect(typeof adapter.sendAudio).toBe('function');
        });

        test('should implement sendDocument()', () => {
            expect(adapter.sendDocument).toBeDefined();
            expect(typeof adapter.sendDocument).toBe('function');
        });

        test('should implement sendMessage()', () => {
            expect(adapter.sendMessage).toBeDefined();
            expect(typeof adapter.sendMessage).toBe('function');
        });

        test('should return error when sending message while not connected', async () => {
            const result = await adapter.sendTextMessage('5511999999999', 'Test');
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('Contacts & Profile Methods', () => {
        test('should implement getProfilePicture()', () => {
            expect(adapter.getProfilePicture).toBeDefined();
            expect(typeof adapter.getProfilePicture).toBe('function');
        });

        test('should implement validateNumber()', () => {
            expect(adapter.validateNumber).toBeDefined();
            expect(typeof adapter.validateNumber).toBe('function');
        });

        test('should implement getContactInfo()', () => {
            expect(adapter.getContactInfo).toBeDefined();
            expect(typeof adapter.getContactInfo).toBe('function');
        });

        test('should return null for profile picture when not connected', async () => {
            const pic = await adapter.getProfilePicture('5511999999999');
            expect(pic).toBeNull();
        });
    });

    describe('Event Methods', () => {
        test('should implement onMessage()', () => {
            expect(adapter.onMessage).toBeDefined();
            expect(typeof adapter.onMessage).toBe('function');
        });

        test('should implement onStatusChange()', () => {
            expect(adapter.onStatusChange).toBeDefined();
            expect(typeof adapter.onStatusChange).toBe('function');
        });

        test('should implement offMessage()', () => {
            expect(adapter.offMessage).toBeDefined();
            expect(typeof adapter.offMessage).toBe('function');
        });

        test('should implement offStatusChange()', () => {
            expect(adapter.offStatusChange).toBeDefined();
            expect(typeof adapter.offStatusChange).toBe('function');
        });

        test('should register message callback', () => {
            const callback = jest.fn();
            adapter.onMessage(callback);
            // Callback should be registered (tested via integration)
            expect(callback).not.toHaveBeenCalled(); // Not called yet
        });

        test('should register status callback', () => {
            const callback = jest.fn();
            adapter.onStatusChange(callback);
            // Callback should be registered (tested via integration)
            expect(callback).not.toHaveBeenCalled(); // Not called yet
        });
    });

    describe('Utility Methods', () => {
        test('should return provider name', () => {
            const name = adapter.getProviderName();
            expect(name).toBe('Baileys');
        });

        test('should return provider version', () => {
            const version = adapter.getProviderVersion();
            expect(typeof version).toBe('string');
            expect(version.length).toBeGreaterThan(0);
        });
    });

    describe('Interface Compliance', () => {
        test('should implement all required IWhatsAppProvider methods', () => {
            const requiredMethods = [
                // Lifecycle
                'initialize', 'restart', 'logout', 'clearSession',
                // Status
                'getStatus', 'isReady',
                // Messaging
                'sendTextMessage', 'sendImage', 'sendVideo', 'sendAudio',
                'sendDocument', 'sendMessage',
                // Contacts
                'getProfilePicture', 'validateNumber', 'getContactInfo',
                // Events
                'onMessage', 'onStatusChange', 'offMessage', 'offStatusChange',
                // Utilities
                'getProviderName', 'getProviderVersion'
            ];

            requiredMethods.forEach(method => {
                expect(adapter).toHaveProperty(method);
                expect(typeof (adapter as unknown as Record<string, unknown>)[method]).toBe('function');
            });
        });
    });
});
