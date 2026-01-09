/**
 * Socket.io Event Emitter Service
 * 
 * Single Responsibility: Emit Socket.io events from server
 * Dependency Inversion: Depends on abstractions (types), not concrete implementations
 */

import type { Server as SocketServer } from 'socket.io';
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    SocketData,
    NewMessageEvent,
    SentMessageEvent,
    ContactUpdatedEvent,
    WhatsAppStatusEvent
} from './types';
import { socketLogger } from '@/lib/logger';

// Unique ID to detect duplicate module instances
const MODULE_ID = `emitter-${Date.now()}-${Math.random()}`;
socketLogger.debug(`[${MODULE_ID}] Module loaded`);

/**
 * Global singleton for Socket.io server
 * Using globalThis to ensure single instance across different builds (server.ts and app code)
 */
interface GlobalSocketio {
    io: SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> | null;
    pendingEvents: Array<{ type: 'message', data: NewMessageEvent }>;
}

declare global {
    var __socketio: GlobalSocketio | undefined;
}

// Initialize global singleton if it doesn't exist
if (!globalThis.__socketio) {
    globalThis.__socketio = {
        io: null,
        pendingEvents: []
    };
    socketLogger.debug(`[${MODULE_ID}] ✅ Global singleton initialized`);
} else {
    socketLogger.debug(`[${MODULE_ID}] ℹ️ Using existing global singleton`);
}

// Local references to global singleton
const getIo = () => globalThis.__socketio!.io;
const setIo = (server: SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> | null) => {
    globalThis.__socketio!.io = server;
};
const getPendingEvents = () => globalThis.__socketio!.pendingEvents;
const setPendingEvents = (events: Array<{ type: 'message', data: NewMessageEvent }>) => {
    globalThis.__socketio!.pendingEvents = events;
};

/**
 * Initialize the Socket.io server instance
 */
export function setSocketServer(
    server: SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
): void {
    setIo(server);
    socketLogger.info('========================================');
    socketLogger.info(`🚀 [${MODULE_ID}] Server instance REGISTERED in GLOBAL singleton!`);
    socketLogger.info(`🚀 [${MODULE_ID}] Socket.io is NOW READY to emit events`);

    // Process pending events
    const pending = getPendingEvents();
    if (pending.length > 0) {
        socketLogger.info(`🚀 [${MODULE_ID}] Processing ${pending.length} pending events...`);
        for (const event of pending) {
            if (event.type === 'message') {
                emitNewMessage(event.data);
            }
        }
        setPendingEvents([]); // Clear queue
        socketLogger.info(`🚀 [${MODULE_ID}] All pending events processed!`);
    }

    socketLogger.info('========================================');
}

/**
 * Get the Socket.io server instance
 */
export function getSocketServer(): SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> | null {
    return getIo();
}

/**
 * Emit a new message event to clients subscribed to a specific contact
 */
export function emitNewMessage(data: NewMessageEvent): boolean {
    const io = getIo();
    if (!io) {
        socketLogger.warn(`[${MODULE_ID}] ⏳ Socket not ready (io is null in global singleton), queueing message for contact: ${data.contactCpf}`);
        const pending = getPendingEvents();
        pending.push({ type: 'message', data });
        setPendingEvents(pending);
        return false; // Not sent immediately, but queued
    }

    const room = `contact:${data.contactCpf}`;
    io.to(room).emit('message:new', data);
    socketLogger.debug(`[${MODULE_ID}] ✅ Emitted message:new to room ${room}`);
    return true;
}

/**
 * Emit a new message event to phone room (for WhatsApp POC)
 */
export function emitNewMessageToPhone(phone: string, data: Omit<NewMessageEvent, 'contactCpf'>): boolean {
    const io = getIo();

    if (!io) {
        socketLogger.error(`[${MODULE_ID}] Cannot emit - Socket.io not initialized`);
        return false;
    }

    const room = `phone:${phone}`;
    const messageData = { ...data, contactCpf: phone };

    // Emit to specific phone room (for chat page)
    io.to(room).emit('message:new', messageData);
    socketLogger.debug(`[${MODULE_ID}] ✅ Emitted message:new to PHONE room ${room}`);

    // BROADCAST to ALL connected clients (for global notifications)
    io.sockets.emit('message:new', messageData);
    socketLogger.debug(`[${MODULE_ID}] 🌍 BROADCAST message:new to ALL ${io.sockets.sockets.size} connected clients`);

    return true;
}

/**
 * Emit a sent message confirmation
 */
export function emitSentMessage(data: SentMessageEvent): void {
    const io = getIo();
    if (!io) {
        socketLogger.warn('Server not initialized, cannot emit message:sent');
        return;
    }

    const room = `contact:${data.contactCpf}`;
    io.to(room).emit('message:sent', data);
    socketLogger.debug(`Emitted message:sent to room ${room}`);
}

/**
 * Emit contact update event to all connected clients
 */
export function emitContactUpdated(data: ContactUpdatedEvent): void {
    const io = getIo();
    if (!io) {
        socketLogger.warn('Server not initialized, cannot emit contact:updated');
        return;
    }

    io.emit('contact:updated', data);
    socketLogger.debug(`Emitted contact:updated for CPF ${data.cpf}`);
}

/**
 * Emit WhatsApp status change to all connected clients
 */
export function emitWhatsAppStatus(data: WhatsAppStatusEvent): void {
    const io = getIo();
    if (!io) {
        socketLogger.warn('Server not initialized, cannot emit whatsapp:status');
        return;
    }

    io.emit('whatsapp:status', data);
    socketLogger.debug(`Emitted whatsapp:status: ${data.status}`);
}

/**
 * Check if Socket.io server is initialized and ready
 */
export function isSocketServerReady(): boolean {
    return getIo() !== null;
}
