"use strict";
/**
 * Socket.io Event Emitter Service
 *
 * Single Responsibility: Emit Socket.io events from server
 * Dependency Inversion: Depends on abstractions (types), not concrete implementations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSocketServer = setSocketServer;
exports.getSocketServer = getSocketServer;
exports.emitNewMessage = emitNewMessage;
exports.emitNewMessageToPhone = emitNewMessageToPhone;
exports.emitSentMessage = emitSentMessage;
exports.emitContactUpdated = emitContactUpdated;
exports.emitWhatsAppStatus = emitWhatsAppStatus;
exports.isSocketServerReady = isSocketServerReady;
// Unique ID to detect duplicate module instances
const MODULE_ID = `emitter-${Date.now()}-${Math.random()}`;
console.log(`[Socket/Emitter] Module loaded with ID: ${MODULE_ID}`);
// Initialize global singleton if it doesn't exist
if (!globalThis.__socketio) {
    globalThis.__socketio = {
        io: null,
        pendingEvents: []
    };
    console.log(`[Socket/${MODULE_ID}] ✅ Global singleton initialized`);
}
else {
    console.log(`[Socket/${MODULE_ID}] ℹ️ Using existing global singleton`);
}
// Local references to global singleton
const getIo = () => globalThis.__socketio.io;
const setIo = (server) => {
    globalThis.__socketio.io = server;
};
const getPendingEvents = () => globalThis.__socketio.pendingEvents;
const setPendingEvents = (events) => {
    globalThis.__socketio.pendingEvents = events;
};
/**
 * Initialize the Socket.io server instance
 */
function setSocketServer(server) {
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
function getSocketServer() {
    return getIo();
}
/**
 * Emit a new message event to clients subscribed to a specific contact
 */
function emitNewMessage(data) {
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
function emitNewMessageToPhone(phone, data) {
    const io = getIo();
    if (!io) {
        console.error(`[Socket/${MODULE_ID}] Cannot emit - Socket.io not initialized`);
        return false;
    }
    const room = `phone:${phone}`;
    const messageData = Object.assign(Object.assign({}, data), { contactCpf: phone });
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
function emitSentMessage(data) {
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
function emitContactUpdated(data) {
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
function emitWhatsAppStatus(data) {
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
function isSocketServerReady() {
    return getIo() !== null;
}
