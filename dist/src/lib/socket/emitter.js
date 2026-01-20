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
exports.emitQueueUpdate = emitQueueUpdate;
exports.isSocketServerReady = isSocketServerReady;
const logger_1 = require("../../lib/logger");
const phoneUtils_1 = require("../../lib/utils/phoneUtils");
// Unique ID to detect duplicate module instances
const MODULE_ID = `emitter-${Date.now()}-${Math.random()}`;
logger_1.socketLogger.debug(`[${MODULE_ID}] Module loaded`);
// Initialize global singleton if it doesn't exist
if (!globalThis.__socketio) {
    globalThis.__socketio = {
        io: null,
        pendingEvents: []
    };
    logger_1.socketLogger.debug(`[${MODULE_ID}] ✅ Global singleton initialized`);
}
else {
    logger_1.socketLogger.debug(`[${MODULE_ID}] ℹ️ Using existing global singleton`);
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
    logger_1.socketLogger.info('========================================');
    logger_1.socketLogger.info(`🚀 [${MODULE_ID}] Server instance REGISTERED in GLOBAL singleton!`);
    logger_1.socketLogger.info(`🚀 [${MODULE_ID}] Socket.io is NOW READY to emit events`);
    // Process pending events
    const pending = getPendingEvents();
    if (pending.length > 0) {
        logger_1.socketLogger.info(`🚀 [${MODULE_ID}] Processing ${pending.length} pending events...`);
        for (const event of pending) {
            if (event.type === 'message') {
                emitNewMessage(event.data);
            }
        }
        setPendingEvents([]); // Clear queue
        logger_1.socketLogger.info(`🚀 [${MODULE_ID}] All pending events processed!`);
    }
    logger_1.socketLogger.info('========================================');
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
        logger_1.socketLogger.warn(`[${MODULE_ID}] ⏳ Socket not ready (io is null in global singleton), queueing message for contact: ${data.contactCpf}`);
        const pending = getPendingEvents();
        pending.push({ type: 'message', data });
        setPendingEvents(pending);
        return false; // Not sent immediately, but queued
    }
    const room = `contact:${data.contactCpf}`;
    io.to(room).emit('message:new', data);
    logger_1.socketLogger.debug(`[${MODULE_ID}] ✅ Emitted message:new to room ${room}`);
    return true;
}
/**
 * Emit a new message event to phone room (for WhatsApp POC)
 */
function emitNewMessageToPhone(phone, data) {
    const io = getIo();
    if (!io) {
        logger_1.socketLogger.error(`[${MODULE_ID}] Cannot emit - Socket.io not initialized`);
        return false;
    }
    // CRITICAL: Normalize phone to match client-side room naming
    const normalizedPhone = (0, phoneUtils_1.normalizePhoneForSocket)(phone);
    const room = `phone:${normalizedPhone}`;
    const messageData = Object.assign(Object.assign({}, data), { contactCpf: phone });
    // Emit to specific phone room (for chat page)
    io.to(room).emit('message:new', messageData);
    logger_1.socketLogger.debug(`[${MODULE_ID}] ✅ Emitted message:new to PHONE room ${room} (original: ${phone})`);
    // BROADCAST to ALL connected clients (for global notifications)
    io.sockets.emit('message:new', messageData);
    logger_1.socketLogger.debug(`[${MODULE_ID}] 🌍 BROADCAST message:new to ALL ${io.sockets.sockets.size} connected clients`);
    return true;
}
/**
 * Emit a sent message confirmation
 */
function emitSentMessage(data) {
    const io = getIo();
    if (!io) {
        logger_1.socketLogger.warn('Server not initialized, cannot emit message:sent');
        return;
    }
    const room = `contact:${data.contactCpf}`;
    io.to(room).emit('message:sent', data);
    logger_1.socketLogger.debug(`Emitted message:sent to room ${room}`);
}
/**
 * Emit contact update event to all connected clients
 */
function emitContactUpdated(data) {
    const io = getIo();
    if (!io) {
        logger_1.socketLogger.warn('Server not initialized, cannot emit contact:updated');
        return;
    }
    io.emit('contact:updated', data);
    logger_1.socketLogger.debug(`Emitted contact:updated for CPF ${data.cpf}`);
}
/**
 * Emit WhatsApp status change to all connected clients
 */
function emitWhatsAppStatus(data) {
    const io = getIo();
    if (!io) {
        logger_1.socketLogger.warn('Server not initialized, cannot emit whatsapp:status');
        return;
    }
    io.emit('whatsapp:status', data);
    logger_1.socketLogger.debug(`Emitted whatsapp:status: ${data.status}`);
}
/**
 * Emit Queue update to all connected clients
 */
function emitQueueUpdate(data) {
    const io = getIo();
    if (!io) {
        // Silent fail or debug log, queue updates might happen before socket ready
        return;
    }
    io.emit('queue:update', data);
}
/**
 * Check if Socket.io server is initialized and ready
 */
function isSocketServerReady() {
    return getIo() !== null;
}
