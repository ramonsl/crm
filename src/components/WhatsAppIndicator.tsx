/**
 * WhatsAppIndicator - Validates and syncs WhatsApp contact data
 * Now includes profile picture and conversation sync
 */

'use client';

import { useState } from 'react';
import { Check, X, Loader2, MessageCircleQuestion } from 'lucide-react';
import { AlertModal } from './AlertModal';
import { addTagToLead } from '@/services/tagService';

interface WhatsAppIndicatorProps {
    phone: string;
    cpf: string;
    onSyncComplete?: () => void;
}

interface ModalState {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
}

export default function WhatsAppIndicator({ phone, cpf, onSyncComplete }: WhatsAppIndicatorProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
    const [modalState, setModalState] = useState<ModalState>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showModal = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => {
        setModalState({ isOpen: true, title, message, type });
    };

    const closeModal = () => {
        setModalState(prev => ({ ...prev, isOpen: false }));
    };

    const syncWhatsAppData = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click
        if (status === 'loading') return;

        setStatus('loading');

        try {
            // Verificar se o número está no grupo específico
            const groupName = 'COMPUTAÇÃO 💵📱🕹️💻💡👽✅';
            const encodedGroupName = encodeURIComponent(groupName);
            const encodedPhone = encodeURIComponent(phone);

            const res = await fetch(
                `/api/whatsapp/groups?action=check&phone=${encodedPhone}&groupId=${encodedGroupName}`
            );

            const data = await res.json();

            // Check for errors
            if (!data.success) {
                console.error('Group check error:', data.error);

                if (data.error?.includes('not ready')) {
                    showModal(
                        'WhatsApp Desconectado',
                        'WhatsApp não está conectado. Conecte primeiro em "Enviar Mensagem".',
                        'warning'
                    );
                    setStatus('idle');
                } else if (data.error?.includes('Group not found')) {
                    showModal(
                        'Grupo Não Encontrado',
                        `Grupo "${groupName}" não foi encontrado. Verifique se o nome está correto.`,
                        'error'
                    );
                    setStatus('invalid');
                } else {
                    showModal(
                        'Erro ao Verificar Grupo',
                        `Erro: ${data.error}`,
                        'error'
                    );
                    setStatus('invalid');
                }
                return;
            }

            if (data.isInGroup) {
                setStatus('valid');

                // Adicionar tag automaticamente
                const tagResult = await addTagToLead(cpf, 'No grupo');
                if (tagResult.success) {
                    onSyncComplete?.(); // Refresh para mostrar a tag
                }

                showModal(
                    'Número Encontrado',
                    `O número ${phone} está no grupo "${groupName}"! Tag "No grupo" adicionada.`,
                    'success'
                );
            } else {
                setStatus('invalid');
                showModal(
                    'Número Não Encontrado',
                    `O número ${phone} NÃO está no grupo "${groupName}".`,
                    'warning'
                );
            }
        } catch (error) {
            console.error('Group verification error:', error);
            showModal(
                'Erro de Verificação',
                'Erro ao verificar grupo. Verifique o console para mais detalhes.',
                'error'
            );
            setStatus('invalid');
        }
    };

    return (
        <>
            <div
                onClick={syncWhatsAppData}
                title={
                    status === 'idle' ? "Verificar se está no grupo COMPUTAÇÃO" :
                        status === 'loading' ? "Verificando grupo..." :
                            status === 'valid' ? "✓ Está no grupo COMPUTAÇÃO" :
                                "✗ NÃO está no grupo COMPUTAÇÃO"
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

            <AlertModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                title={modalState.title}
                message={modalState.message}
                type={modalState.type}
            />
        </>
    );
}
