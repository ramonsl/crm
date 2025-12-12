'use client';

/**
 * WhatsApp Notification Manager
 * Global component that listens for new messages and shows notifications
 * Works across all pages of the application
 */

import { useEffect, useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';

export function WhatsAppNotificationManager() {
    const { socket } = useSocket();
    const [isClient, setIsClient] = useState(false);

    // Ensure this only runs on client-side
    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) {
            console.log('[WhatsAppNotificationManager] ⏸️ Waiting for client-side hydration...');
            return;
        }

        console.log('🔔 [WhatsAppNotificationManager] Client-side ready!');
        console.log('🔌 [WhatsAppNotificationManager] Socket status:', socket ? 'CONNECTED' : 'NOT CONNECTED');
    }, [isClient, socket]);

    // Create notification beep using Web Audio API
    const playBeep = () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);

            console.log('[WhatsAppNotifications] ✅ Beep played');
        } catch (err) {
            console.error('[WhatsAppNotifications] Failed to play beep:', err);
        }
    };

    useEffect(() => {
        console.log('🎯 [WhatsAppNotificationManager] useEffect triggered');
        if (!isClient) return;
        if (!socket) {
            console.log('[WhatsAppNotifications] ❌ No socket available - waiting for connection');
            return;
        }

        console.log('[WhatsAppNotifications] ✅ Socket available! Setting up global notification listener');
        console.log('[WhatsAppNotifications] Socket ID:', socket.id);
        console.log('[WhatsAppNotifications] Socket connected:', socket.connected);

        // Request notification permission on mount
        if ('Notification' in window) {
            console.log('[WhatsAppNotifications] Notification permission:', Notification.permission);
            if (Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    console.log('[WhatsAppNotifications] Permission result:', permission);
                });
            }
        }

        const handleNewMessage = (data: any) => {
            console.log('🔔🔔🔔 [WhatsAppNotifications] ===== NEW MESSAGE EVENT RECEIVED =====');
            console.log('📦 [WhatsAppNotifications] Data:', data);
            console.log('📍 [WhatsAppNotifications] Current URL:', window.location.pathname);

            // Play notification sound
            console.log('🔊 [WhatsAppNotifications] Playing beep...');
            playBeep();

            // Show desktop notification
            if ('Notification' in window && Notification.permission === 'granted') {
                const title = data.contactName || 'Nova mensagem WhatsApp';
                const body = data.message?.body || 'Você recebeu uma nova mensagem';

                console.log('[WhatsAppNotifications] 📢 Showing notification:', title);

                const notification = new Notification(title, {
                    body: body.substring(0, 100),
                    icon: '/whatsapp-icon.png',
                    badge: '/whatsapp-icon.png',
                    tag: `whatsapp-${data.contactId}`,
                    requireInteraction: false,
                });

                notification.onclick = () => {
                    window.focus();
                    // Navigate to WhatsApp chat page
                    window.location.href = '/whatsapp-chat';
                    notification.close();
                };

                setTimeout(() => notification.close(), 5000);
            } else if ('Notification' in window) {
                console.warn('[WhatsAppNotifications] ⚠️ Notification permission not granted:', Notification.permission);
            }

            console.log('✅ [WhatsAppNotifications] ===== NOTIFICATION HANDLING COMPLETE =====');
        };

        console.log('[WhatsAppNotifications] 📡 Registering listener for message:new event...');
        socket.on('message:new', handleNewMessage);
        console.log('[WhatsAppNotifications] ✅ Listener registered successfully');

        return () => {
            console.log('[WhatsAppNotifications] 🧹 Cleaning up global notification listener');
            socket.off('message:new', handleNewMessage);
        };
    }, [isClient, socket]);

    // This component renders nothing
    return null;
}
