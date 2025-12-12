'use client';

/**
 * useSocketMessagesPhone Hook
 * 
 * Hook para mensagens em tempo real via Socket.io usando telefone
 * Específico para POC do WhatsApp Chat
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

interface UseSocketMessagesPhoneOptions {
    phone: string | null;
    onNewMessage?: (message: Message) => void;
    enabled?: boolean;
}

export function useSocketMessagesPhone({
    phone,
    onNewMessage,
    enabled = true
}: UseSocketMessagesPhoneOptions) {
    console.log('[useSocketMessagesPhone] Hook called with phone:', phone, 'enabled:', enabled);

    const { socket, isConnected } = useSocket();
    const currentRoomRef = useRef<string | null>(null);

    console.log('[useSocketMessagesPhone] Socket:', !!socket, 'isConnected:', isConnected);

    // Join phone room when phone is selected
    useEffect(() => {
        if (!socket || !isConnected || !enabled || !phone) {
            return;
        }

        const room = phone;

        // Leave previous room if exists
        if (currentRoomRef.current && currentRoomRef.current !== room) {
            console.log(`[SocketPhone] Leaving room: phone:${currentRoomRef.current}`);
            socket.emit('room:leave', currentRoomRef.current);
        }

        // Join new room
        console.log(`[SocketPhone] Joining room: phone:${room}`);
        socket.emit('room:join', room);
        currentRoomRef.current = room;

        return () => {
            if (currentRoomRef.current) {
                console.log(`[SocketPhone] Cleanup: Leaving room phone:${currentRoomRef.current}`);
                socket.emit('room:leave', currentRoomRef.current);
                currentRoomRef.current = null;
            }
        };
    }, [socket, isConnected, phone, enabled]);

    // Listen for new messages
    useEffect(() => {
        if (!socket || !enabled) {
            return;
        }

        const handleNewMessage = (data: NewMessageEvent) => {
            console.log('[SocketPhone] New message received:', data);

            // We're already in the correct room, so just emit all messages
            // The backend emits to the room, so we trust the message is for us
            if (onNewMessage) {
                console.log('[SocketPhone] Calling onNewMessage callback');
                onNewMessage(data.message);
            }
        };

        socket.on('message:new', handleNewMessage);
        console.log('[SocketPhone] Listener registered for message:new');

        return () => {
            socket.off('message:new', handleNewMessage);
            console.log('[SocketPhone] Listener removed for message:new');
        };
    }, [socket, onNewMessage, enabled]);

    return {
        isConnected
    };
}
