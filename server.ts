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

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
console.log('[Server] 🏁 Starting server script...');
config({ path: resolve(process.cwd(), '.env.local') });
console.log('[Server] 🌍 Environment variables loaded');

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    SocketData
} from './src/lib/socket/types';
import { setSocketServer } from './src/lib/socket/emitter';
import { normalizePhoneForSocket } from './src/lib/utils/phoneUtils';
import { WhatsAppProviderFactory } from './src/lib/whatsapp/factory';
import { socketAuthMiddleware } from './src/lib/socket/authMiddleware';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log('[Server] 🏗️ Preparing Next.js app...');
app.prepare().then(() => {
    console.log('[Server] ✅ Next.js app prepared');
    // Create HTTP server
    const httpServer = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling request', err);
            res.statusCode = 500;
            res.end('Internal server error');
        }
    });

    // Initialize Socket.io
    const io = new SocketIOServer<
        ClientToServerEvents,
        ServerToClientEvents,
        {},
        SocketData
    >(httpServer, {
        cors: {
            origin: dev ? 'http://localhost:3000' : false,
            credentials: true
        },
        path: '/socket.io/',
        transports: ['websocket', 'polling']
    });

    // Register Socket.io server globally for event emission
    setSocketServer(io);

    // Socket.io authentication middleware
    io.use(socketAuthMiddleware);

    // Socket.io connection handler
    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);

        // Send connection confirmation
        socket.emit('connected');

        // Handle room join (for contact-specific updates)
        socket.on('room:join', (contactCpf: string) => {
            const room = `contact:${contactCpf}`;
            socket.join(room);
            console.log(`[Socket] ${socket.id} joined room ${room}`);
        });

        // Handle room leave
        socket.on('room:leave', (contactCpf: string) => {
            const room = `contact:${contactCpf}`;
            socket.leave(room);
            console.log(`[Socket] ${socket.id} left room ${room}`);
        });

        // Handle phone room join (for WhatsApp Chat)
        socket.on('room:join:phone', (phone: string) => {
            // Normalize phone for consistent room naming
            const normalizedPhone = normalizePhoneForSocket(phone);
            const room = `phone:${normalizedPhone}`;
            socket.join(room);
            console.log(`[Socket] ${socket.id} joined PHONE room ${room} (original: ${phone})`);
        });

        // Handle phone room leave
        socket.on('room:leave:phone', (phone: string) => {
            // Normalize phone for consistent room naming
            const normalizedPhone = normalizePhoneForSocket(phone);
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
            } catch (error) {
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
        console.log(`[Server] 🚀 Ready on http://${hostname}:${port}`);
        console.log(`[Server] 📡 Socket.io server running on port ${port}`);

        // Initialize WhatsApp client using factory (load from DB persistence)
        WhatsAppProviderFactory.getProvider().then(async (provider) => {
            console.log(`> Initializing WhatsApp provider: ${provider.getProviderName()}...`);

            try {
                // Register message handler BEFORE initialization to catch early messages
                const { baileysMessageHandler } = await import('./src/services/BaileysMessageHandler');

                provider.onMessage(async (msg) => {
                    // Normalize the message object if needed, but BaileysMessageHandler expects
                    // 'BaileysMessage' which matches 'WhatsAppMessage' structure closely enough
                    // (from: string, body: string, isGroup: boolean, timestamp: Date, fromMe: boolean, id: string)
                    await baileysMessageHandler.handle(msg);
                });

                // Register Log handler
                try {
                    const { messageQueue } = await import('./src/lib/messageQueue');
                    provider.onLog((message, type) => {
                        messageQueue.addLog(message, type);
                    });
                } catch (e) {
                    console.error('Failed to bind messageQueue logger:', e);
                }

                console.log('> WhatsApp Listeners registered (Message & Log)');

                await provider.initialize();
                console.log(`> ${provider.getProviderName()} initialized successfully`);

            } catch (err) {
                console.error('Failed to initialize WhatsApp:', err);
            }
        }).catch((err) => {
            console.error('Failed to get WhatsApp provider:', err);
        });
    });
});
