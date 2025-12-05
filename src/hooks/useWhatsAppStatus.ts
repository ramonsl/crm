/**
 * Hook for managing WhatsApp status
 */

import { useState, useEffect } from 'react';

type WhatsAppStatus = 'disconnected' | 'initializing' | 'ready';

export function useWhatsAppStatus() {
    const [status, setStatus] = useState<WhatsAppStatus>('disconnected');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/whatsapp');
                const data = await res.json();
                setStatus(data.status);
            } catch (error) {
                console.error('Error checking WhatsApp status:', error);
                setStatus('disconnected');
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    return {
        status,
        loading,
        isReady: status === 'ready',
        isDisconnected: status === 'disconnected',
        isInitializing: status === 'initializing'
    };
}
