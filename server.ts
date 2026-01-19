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
config({ path: resolve(process.cwd(), '.env.local') });

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketServer } from 'socket.io';
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    SocketData
} from './src/lib/socket/types';
import { setSocketServer } from './src/lib/socket/emitter';
import { initializeWhatsApp, getProvider } from './src/lib/whatsapp/provider';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
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
    const io = new SocketServer<
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
    io.use(async (socket, next) => {
        try {
            // Extract session from handshake (cookies are automatically sent)
            const cookies = socket.handshake.headers.cookie;

            if (!cookies) {
                console.warn('[Socket] No cookies in handshake');
                return next(new Error('Authentication required'));
            }

            // For now, we accept any connection with cookies
            // In production, validate session token here
            socket.data.sessionId = 'session-' + Date.now();

            console.log(`[Socket] Client authenticated: ${socket.id}`);
            next();
        } catch (error) {
            console.error('[Socket] Authentication error:', error);
            next(new Error('Authentication failed'));
        }
    });

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
        console.log(`> Ready on http://${hostname}:${port}`);
        console.log(`> Socket.io server running on port ${port}`);

        // Initialize WhatsApp client using configured provider
        const provider = getProvider();
        console.log(`> Initializing WhatsApp client (provider: ${provider})...`);
        initializeWhatsApp().catch(err => {
            console.error('Failed to initialize WhatsApp:', err);
        });
    });
});
