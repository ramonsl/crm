'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import type { WhatsAppHistoryEvent } from '@/lib/socket/types';

export function useSocketHistorySync() {
    const { socket } = useSocket();
    const [historySync, setHistorySync] = useState<WhatsAppHistoryEvent | null>(null);

    useEffect(() => {
        if (!socket) return;

        const handleHistorySync = (data: WhatsAppHistoryEvent) => {
            console.log('📋 [useSocketHistorySync] Progress updated', data);
            setHistorySync(data);

            // Auto-clear after 5 seconds if progress is 100
            if (data.progress === 100) {
                setTimeout(() => {
                    setHistorySync(prev => prev?.progress === 100 ? null : prev);
                }, 5000);
            }
        };

        socket.on('whatsapp:history', handleHistorySync);

        return () => {
            socket.off('whatsapp:history', handleHistorySync);
        };
    }, [socket]);

    return { historySync };
}
