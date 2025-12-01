'use client';

import { useState } from 'react';
import { Check, X, Loader2, MessageCircleQuestion } from 'lucide-react';

interface WhatsAppIndicatorProps {
    phone: string;
}

export default function WhatsAppIndicator({ phone }: WhatsAppIndicatorProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');

    const validateNumber = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click
        if (status === 'loading') return;

        setStatus('loading');
        try {
            const res = await fetch(`/api/whatsapp/validate?phone=${encodeURIComponent(phone)}`);
            const data = await res.json();
            setStatus(data.valid ? 'valid' : 'invalid');
        } catch (error) {
            console.error('Validation error:', error);
            setStatus('invalid');
        }
    };

    return (
        <div
            onClick={validateNumber}
            title={
                status === 'idle' ? "Verificar WhatsApp" :
                    status === 'loading' ? "Verificando..." :
                        status === 'valid' ? "WhatsApp Válido" : "WhatsApp Inválido"
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
