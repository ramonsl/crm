'use client';

/**
 * useSocketMessages Hook
 * 
 * Custom hook para gerenciar mensagens em tempo real via Socket.io
 * 
 * Responsabilidades:
 * - Escutar eventos de novas mensagens
 * - Atualizar estado de mensagens automaticamente
 * - Gerenciar inscrição em salas de contatos
 * - Cleanup automático de listeners
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import type { NewMessageEvent } from '@/lib/socket/types';

interface Message {
    id: number;
    message_id?: string;
    direction: 'incoming' | 'outgoing';
    body: string;
    timestamp: string;
    status: string;
    media_url: string | null;
    media_type?: string | null;
}

interface UseSocketMessagesOptions {
    contactCpf: string | null;
    onNewMessage?: (message: Message) => void;
    enabled?: boolean;
}

export function useSocketMessages({
    contactCpf,
    onNewMessage,
    enabled = true
}: UseSocketMessagesOptions) {
    const { socket, isConnected } = useSocket();
    const currentRoomRef = useRef<string | null>(null);

    // Join contact room when contact is selected
    useEffect(() => {
        if (!socket || !isConnected || !enabled || !contactCpf) {
            return;
        }

        const room = contactCpf;

        // Leave previous room if exists
        if (currentRoomRef.current && currentRoomRef.current !== room) {
            console.log(`[Socket] Leaving room: contact:${currentRoomRef.current}`);
            socket.emit('room:leave', currentRoomRef.current);
        }

        // Join new room
        console.log(`[Socket] Joining room: contact:${room}`);
        socket.emit('room:join', room);
        currentRoomRef.current = room;

        return () => {
            if (currentRoomRef.current) {
                console.log(`[Socket] Cleanup: Leaving room contact:${currentRoomRef.current}`);
                socket.emit('room:leave', currentRoomRef.current);
                currentRoomRef.current = null;
            }
        };
    }, [socket, isConnected, contactCpf, enabled]);

    // Listen for new messages
    useEffect(() => {
        if (!socket || !enabled) {
            return;
        }

        const handleNewMessage = (data: NewMessageEvent) => {
            console.log('[Socket] New message received:', data);

            // Only process if it's for the current contact
            if (contactCpf && data.contactCpf === contactCpf) {
                if (onNewMessage) {
                    onNewMessage(data.message);
                }
            }
        };

        socket.on('message:new', handleNewMessage);
        console.log('[Socket] Listener registered for message:new');

        return () => {
            socket.off('message:new', handleNewMessage);
            console.log('[Socket] Listener removed for message:new');
        };
    }, [socket, contactCpf, onNewMessage, enabled]);

    return {
        isConnected
    };
}
