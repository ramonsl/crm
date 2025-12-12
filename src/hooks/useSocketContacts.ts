/**
 * Hook for WebSocket-based contact list updates
 * Listens for new messages and updates the chat list in real-time
 * Note: Notifications are handled globally by WhatsAppNotificationManager
 */

import { useEffect, useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import type { ContactUpdatedEvent } from '@/lib/socket/types';

interface UseSocketContactsOptions {
    onContactUpdated?: (data: ContactUpdatedEvent) => void;
    enabled?: boolean;
}

interface UseSocketContactsReturn {
    refreshTrigger: number;
}

export function useSocketContacts(options?: UseSocketContactsOptions): UseSocketContactsReturn {
    const { socket } = useSocket();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { onContactUpdated, enabled = true } = options || {};

    useEffect(() => {
        if (!socket || !enabled) {
            console.log('[useSocketContacts] ❌ No socket available or disabled');
            return;
        }

        console.log('[useSocketContacts] ✅ Setting up contact update listener');

        const handleNewMessage = (data: any) => {
            console.log('📋 [useSocketContacts] New message - triggering chat list refresh', data);

            // Trigger refresh of contact list
            setRefreshTrigger(prev => {
                const newValue = prev + 1;
                console.log(`📋 [useSocketContacts] refreshTrigger: ${prev} → ${newValue}`);
                return newValue;
            });
        };

        const handleContactUpdated = (data: ContactUpdatedEvent) => {
            console.log('📋 [useSocketContacts] Contact updated', data);
            if (onContactUpdated) {
                onContactUpdated(data);
            }
        };

        socket.on('message:new', handleNewMessage);
        socket.on('contact:updated', handleContactUpdated);

        return () => {
            socket.off('message:new', handleNewMessage);
            socket.off('contact:updated', handleContactUpdated);
            console.log('[useSocketContacts] Cleaned up contact update listener');
        };
    }, [socket, enabled, onContactUpdated]);

    return { refreshTrigger };
}
