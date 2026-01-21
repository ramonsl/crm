/**
 * Socket Emitter Tests
 * 
 * Testa a emissão de eventos Socket.io seguindo boas práticas de testing
 */

import { setSocketServer, emitNewMessage, emitContactUpdated, isSocketServerReady } from '@/lib/socket/emitter';
import type { Server as SocketServer } from 'socket.io';

describe('Socket Emitter', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockIo: jest.Mocked<SocketServer<any, any, any, any>>;

    beforeEach(() => {
        mockIo = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('setSocketServer', () => {
        it('should register socket server instance', () => {
            setSocketServer(mockIo);
            expect(isSocketServerReady()).toBe(true);
        });
    });

    describe('emitNewMessage', () => {
        it('should emit message:new event to correct room', () => {
            setSocketServer(mockIo);

            const messageData = {
                contactCpf: '12345678900',
                message: {
                    id: 1,
                    message_id: 'msg_123',
                    direction: 'incoming' as const,
                    body: 'Test message',
                    media_url: null,
                    media_type: null,
                    timestamp: '2024-01-01T00:00:00Z',
                    status: 'sent'
                }
            };

            emitNewMessage(messageData);

            expect(mockIo.to).toHaveBeenCalledWith('contact:12345678900');
            expect(mockIo.emit).toHaveBeenCalledWith('message:new', messageData);
        });

        it('should not fail if socket server is not initialized', () => {
            // Reset to null
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setSocketServer(null as any);

            expect(() => {
                emitNewMessage({
                    contactCpf: '12345678900',
                    message: {
                        id: 1,
                        message_id: 'msg_123',
                        direction: 'incoming',
                        body: 'Test',
                        media_url: null,
                        media_type: null,
                        timestamp: '2024-01-01T00:00:00Z',
                        status: 'sent'
                    }
                });
            }).not.toThrow();
        });
    });

    describe('emitContactUpdated', () => {
        it('should emit contact:updated event to all clients', () => {
            setSocketServer(mockIo);

            const updateData = {
                cpf: '12345678900',
                updates: {
                    last_message: 'Hello',
                    last_message_time: '2024-01-01T00:00:00Z',
                    last_message_direction: 'incoming' as const,
                    unread_count: 1
                }
            };

            emitContactUpdated(updateData);

            expect(mockIo.emit).toHaveBeenCalledWith('contact:updated', updateData);
        });
    });

    describe('isSocketServerReady', () => {
        it('should return false when no server is set', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setSocketServer(null as any);
            expect(isSocketServerReady()).toBe(false);
        });

        it('should return true when server is set', () => {
            setSocketServer(mockIo);
            expect(isSocketServerReady()).toBe(true);
        });
    });
});
