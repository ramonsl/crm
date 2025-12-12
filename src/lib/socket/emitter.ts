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

// Unique ID to detect duplicate module instances
const MODULE_ID = `emitter-${Date.now()}-${Math.random()}`;
console.log(`[Socket/Emitter] Module loaded with ID: ${MODULE_ID}`);

/**
 * Global singleton for Socket.io server
 * Using globalThis to ensure single instance across different builds (server.ts and app code)
 */
interface GlobalSocketio {
    io: SocketServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData> | null;
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
    console.log(`[Socket/${MODULE_ID}] ✅ Global singleton initialized`);
} else {
    console.log(`[Socket/${MODULE_ID}] ℹ️ Using existing global singleton`);
}

// Local references to global singleton
const getIo = () => globalThis.__socketio!.io;
const setIo = (server: SocketServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData> | null) => {
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
    server: SocketServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>
): void {
    setIo(server);
    console.log('========================================');
    console.log(`🚀 [Socket/${MODULE_ID}] Server instance REGISTERED in GLOBAL singleton!`);
    console.log(`🚀 [Socket/${MODULE_ID}] Socket.io is NOW READY to emit events`);

    // Process pending events
    const pending = getPendingEvents();
    if (pending.length > 0) {
        console.log(`🚀 [Socket/${MODULE_ID}] Processing ${pending.length} pending events...`);
        for (const event of pending) {
            if (event.type === 'message') {
                emitNewMessage(event.data);
            }
        }
        setPendingEvents([]); // Clear queue
        console.log(`🚀 [Socket/${MODULE_ID}] All pending events processed!`);
    }

    console.log('========================================');
}

/**
 * Get the Socket.io server instance
 */
export function getSocketServer(): SocketServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData> | null {
    return getIo();
}

/**
 * Emit a new message event to clients subscribed to a specific contact
 */
export function emitNewMessage(data: NewMessageEvent): boolean {
    const io = getIo();
    if (!io) {
        console.warn(`[Socket/${MODULE_ID}] ⏳ Socket not ready (io is null in global singleton), queueing message for contact: ${data.contactCpf}`);
        const pending = getPendingEvents();
        pending.push({ type: 'message', data });
        setPendingEvents(pending);
        return false; // Not sent immediately, but queued
    }

    const room = `contact:${data.contactCpf}`;
    io.to(room).emit('message:new', data);
    console.log(`[Socket/${MODULE_ID}] ✅ Emitted message:new to room ${room}`);
    return true;
}

/**
 * Emit a new message event to phone room (for WhatsApp POC)
 */
export function emitNewMessageToPhone(phone: string, data: Omit<NewMessageEvent, 'contactCpf'>): boolean {
    const io = getIo();

    if (!io) {
        console.error(`[Socket/${MODULE_ID}] Cannot emit - Socket.io not initialized`);
        return false;
    }

    const room = `phone:${phone}`;
    const messageData = { ...data, contactCpf: phone };

    // Emit to specific phone room (for chat page)
    io.to(room).emit('message:new', messageData);
    console.log(`[Socket/${MODULE_ID}] ✅ Emitted message:new to PHONE room ${room}`);

    // BROADCAST to ALL connected clients (for global notifications)
    io.sockets.emit('message:new', messageData);
    console.log(`[Socket/${MODULE_ID}] 🌍 BROADCAST message:new to ALL ${io.sockets.sockets.size} connected clients`);

    return true;
}

/**
 * Emit a sent message confirmation
 */
export function emitSentMessage(data: SentMessageEvent): void {
    const io = getIo();
    if (!io) {
        console.warn('[Socket] Server not initialized, cannot emit message:sent');
        return;
    }

    const room = `contact:${data.contactCpf}`;
    io.to(room).emit('message:sent', data);
    console.log(`[Socket] Emitted message:sent to room ${room}`);
}

/**
 * Emit contact update event to all connected clients
 */
export function emitContactUpdated(data: ContactUpdatedEvent): void {
    const io = getIo();
    if (!io) {
        console.warn('[Socket] Server not initialized, cannot emit contact:updated');
        return;
    }

    io.emit('contact:updated', data);
    console.log(`[Socket] Emitted contact:updated for CPF ${data.cpf}`);
}

/**
 * Emit WhatsApp status change to all connected clients
 */
export function emitWhatsAppStatus(data: WhatsAppStatusEvent): void {
    const io = getIo();
    if (!io) {
        console.warn('[Socket] Server not initialized, cannot emit whatsapp:status');
        return;
    }

    io.emit('whatsapp:status', data);
    console.log(`[Socket] Emitted whatsapp:status: ${data.status}`);
}

/**
 * Check if Socket.io server is initialized and ready
 */
export function isSocketServerReady(): boolean {
    return getIo() !== null;
}
