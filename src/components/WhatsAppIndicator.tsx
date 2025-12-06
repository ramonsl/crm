/**
 * WhatsAppIndicator - Validates and syncs WhatsApp contact data
 * Now includes profile picture and conversation sync
 */

'use client';

import { useState } from 'react';
import { Check, X, Loader2, MessageCircleQuestion } from 'lucide-react';

interface WhatsAppIndicatorProps {
    phone: string;
    onSyncComplete?: () => void;
}

export default function WhatsAppIndicator({ phone, onSyncComplete }: WhatsAppIndicatorProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');

    const syncWhatsAppData = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click
        if (status === 'loading') return;

        setStatus('loading');

        try {
            const res = await fetch('/api/contacts/sync-whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });

            const data = await res.json();

            // Check for specific errors
            if (data.error) {
                console.error('Sync error:', data.error);

                if (data.error.includes('not ready')) {
                    alert('⚠️ WhatsApp não está conectado. Conecte primeiro em "Enviar Mensagem".');
                    setStatus('idle');
                } else {
                    setStatus('invalid');
                }
                return;
            }

            if (data.valid) {
                setStatus('valid');
                // Don't refresh during validation to avoid unmounting component
                // User can manually refresh if needed
                // onSyncComplete?.();
            } else {
                setStatus('invalid');
            }
        } catch (error) {
            console.error('Sync error:', error);
            setStatus('invalid');
        }
    };

    return (
        <div
            onClick={syncWhatsAppData}
            title={
                status === 'idle' ? "Validar e Sincronizar WhatsApp" :
                    status === 'loading' ? "Sincronizando dados..." :
                        status === 'valid' ? "WhatsApp Válido (Foto e conversas sincronizadas)" :
                            "WhatsApp Inválido"
            }
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 8,
                cursor: 'pointer',
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor:
                    status === 'idle' ? '#f1f5f9' :
                        status === 'loading' ? '#e2e8f0' :
                            status === 'valid' ? '#dcfce7' : '#fee2e2',
                transition: 'all 0.2s'
            }}
        >
            {status === 'idle' && <MessageCircleQuestion size={14} color="#64748b" />}
            {status === 'loading' && <Loader2 size={14} className="animate-spin" color="#64748b" />}
            {status === 'valid' && <Check size={14} color="#16a34a" />}
            {status === 'invalid' && <X size={14} color="#dc2626" />}
        </div>
    );
}
