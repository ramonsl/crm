'use client';

/**
 * Socket.io Context Provider
 * 
 * Manages WebSocket connection lifecycle and provides socket instance
 * to all components via React Context.
 * 
 * Follows Single Responsibility Principle:
 * - Connection management only
 * - Event subscription handled by custom hooks
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@/lib/socket/types';

type SocketClient = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextValue {
    socket: SocketClient | null;
    isConnected: boolean;
    connect: () => void;
    disconnect: () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

interface SocketProviderProps {
    children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
    const [socket, setSocket] = useState<SocketClient | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const connect = useCallback(() => {
        if (socket?.connected) {
            console.log('[Socket] Already connected');
            return;
        }

        console.log('[Socket] Connecting to WebSocket server...');

        const newSocket: SocketClient = io({
            path: '/socket.io/',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });

        newSocket.on('connect', () => {
            console.log('[Socket] Connected!', newSocket.id);
            setIsConnected(true);
        });

        newSocket.on('connected', () => {
            console.log('[Socket] Server acknowledged connection');
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
            setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error);
            setIsConnected(false);
        });

        setSocket(newSocket);
    }, [socket]);

    const disconnect = useCallback(() => {
        if (socket) {
            console.log('[Socket] Disconnecting...');
            socket.disconnect();
            setSocket(null);
            setIsConnected(false);
        }
    }, [socket]);

    // Auto-connect on mount
    useEffect(() => {
        connect();

        return () => {
            disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected, connect, disconnect }}>
            {children}
        </SocketContext.Provider>
    );
}

/**
 * Hook to access socket context
 * Must be used within a SocketProvider
 */
export function useSocket() {
    const context = useContext(SocketContext);

    if (context === undefined) {
        throw new Error('useSocket must be used within a SocketProvider');
    }

    return context;
}
