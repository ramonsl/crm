"use strict";
/**
 * Custom Next.js Server with Socket.io Integration
 *
 * This custom server enables WebSocket support via Socket.io while
 * maintaining all existing Next.js functionality.
 *
 * Architecture:
 * - HTTP Server handles Next.js requests
 * - Socket.io attached to the same server for WebSocket connections
 * - Authentication middleware validates socket connections
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables from .env.local
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(process.cwd(), '.env.local') });
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const socket_io_1 = require("socket.io");
const emitter_1 = require("./src/lib/socket/emitter");
const phoneUtils_1 = require("./src/lib/utils/phoneUtils");
const factory_1 = require("./src/lib/whatsapp/factory");
const authMiddleware_1 = require("./src/lib/socket/authMiddleware");
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
// Initialize Next.js
const app = (0, next_1.default)({ dev, hostname, port });
const handle = app.getRequestHandler();
app.prepare().then(() => {
    // Create HTTP server
    const httpServer = (0, http_1.createServer)(async (req, res) => {
        try {
            const parsedUrl = (0, url_1.parse)(req.url, true);
            await handle(req, res, parsedUrl);
        }
        catch (err) {
            console.error('Error occurred handling request', err);
            res.statusCode = 500;
            res.end('Internal server error');
        }
    });
    // Initialize Socket.io
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: dev ? 'http://localhost:3000' : false,
            credentials: true
        },
        path: '/socket.io/',
        transports: ['websocket', 'polling']
    });
    // Register Socket.io server globally for event emission
    (0, emitter_1.setSocketServer)(io);
    // Socket.io authentication middleware
    io.use(authMiddleware_1.socketAuthMiddleware);
    // Socket.io connection handler
    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);
        // Send connection confirmation
        socket.emit('connected');
        // Handle room join (for contact-specific updates)
        socket.on('room:join', (contactCpf) => {
            const room = `contact:${contactCpf}`;
            socket.join(room);
            console.log(`[Socket] ${socket.id} joined room ${room}`);
        });
        // Handle room leave
        socket.on('room:leave', (contactCpf) => {
            const room = `contact:${contactCpf}`;
            socket.leave(room);
            console.log(`[Socket] ${socket.id} left room ${room}`);
        });
        // Handle phone room join (for WhatsApp Chat)
        socket.on('room:join:phone', (phone) => {
            // Normalize phone for consistent room naming
            const normalizedPhone = (0, phoneUtils_1.normalizePhoneForSocket)(phone);
            const room = `phone:${normalizedPhone}`;
            socket.join(room);
            console.log(`[Socket] ${socket.id} joined PHONE room ${room} (original: ${phone})`);
        });
        // Handle phone room leave
        socket.on('room:leave:phone', (phone) => {
            // Normalize phone for consistent room naming
            const normalizedPhone = (0, phoneUtils_1.normalizePhoneForSocket)(phone);
            const room = `phone:${normalizedPhone}`;
            socket.leave(room);
            console.log(`[Socket] ${socket.id} left PHONE room ${room} (original: ${phone})`);
        });
        // Handle message send (optional - can keep using REST API)
        socket.on('message:send', async (data, callback) => {
            try {
                // This is optional - we can keep using the existing REST API
                // For now, just acknowledge
                callback({ success: false, error: 'Use REST API /api/chat/send instead' });
            }
            catch (error) {
                console.error('[Socket] Error handling message:send:', error);
                callback({ success: false, error: 'Internal error' });
            }
        });
        // Handle disconnection
        socket.on('disconnect', (reason) => {
            console.log(`[Socket] Client disconnected: ${socket.id}, reason: ${reason}`);
        });
    });
    // Start server
    httpServer.once('error', (err) => {
        console.error('[Server] Fatal error:', err);
        process.exit(1);
    });
    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
        console.log(`> Socket.io server running on port ${port}`);
        // Initialize WhatsApp client using factory (load from DB persistence)
        factory_1.WhatsAppProviderFactory.getProvider().then(async (provider) => {
            console.log(`> Initializing WhatsApp provider: ${provider.getProviderName()}...`);
            try {
                // Register message handler BEFORE initialization to catch early messages
                const { baileysMessageHandler } = await Promise.resolve().then(() => __importStar(require('./src/services/BaileysMessageHandler')));
                provider.onMessage(async (msg) => {
                    // Normalize the message object if needed, but BaileysMessageHandler expects
                    // 'BaileysMessage' which matches 'WhatsAppMessage' structure closely enough
                    // (from: string, body: string, isGroup: boolean, timestamp: Date, fromMe: boolean, id: string)
                    await baileysMessageHandler.handle(msg);
                });
                // Register Log handler
                try {
                    const { messageQueue } = await Promise.resolve().then(() => __importStar(require('./src/lib/messageQueue')));
                    provider.onLog((message, type) => {
                        messageQueue.addLog(message, type);
                    });
                }
                catch (e) {
                    console.error('Failed to bind messageQueue logger:', e);
                }
                console.log('> WhatsApp Listeners registered (Message & Log)');
                await provider.initialize();
                console.log(`> ${provider.getProviderName()} initialized successfully`);
            }
            catch (err) {
                console.error('Failed to initialize WhatsApp:', err);
            }
        }).catch((err) => {
            console.error('Failed to get WhatsApp provider:', err);
        });
    });
});
