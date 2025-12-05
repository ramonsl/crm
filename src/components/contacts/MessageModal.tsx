/**
 * MessageModal - Modal for sending WhatsApp messages
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useTemplates } from '@/hooks/useTemplates';
import type { Contact } from '@/types/contacts';
import styles from './MessageModal.module.css';

interface MessageModalProps {
    contact: Contact | null;
    isOpen: boolean;
    onClose: () => void;
    onSent: () => void;
}

type MessageMode = 'template' | 'custom';

export function MessageModal({ contact, isOpen, onClose, onSent }: MessageModalProps) {
    const { success, error: toastError } = useToast();
    const [mode, setMode] = useState<MessageMode>('template');
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [customMessage, setCustomMessage] = useState('');
    const [sending, setSending] = useState(false);
    const { templates } = useTemplates();

    if (!isOpen || !contact) return null;

    const getMessageToSend = (): string => {
        if (mode === 'template') {
            const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
            return selectedTemplate?.message || '';
        }
        return customMessage;
    };

    const isMessageValid = (): boolean => {
        if (mode === 'template') {
            return selectedTemplateId !== null;
        }
        return customMessage.trim().length > 0;
    };

    const handleSend = async () => {
        const messageToSend = getMessageToSend();

        if (!messageToSend.trim()) {
            toastError(mode === 'template' ? 'Selecione um modelo' : 'Digite uma mensagem');
            return;
        }

        setSending(true);

        try {
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: contact.telefone,
                    message: messageToSend.trim()
                })
            });

            if (response.ok) {
                success('Mensagem enviada com sucesso!');
                resetForm();
                onSent();
                onClose();
            } else {
                const errorData = await response.json();
                toastError(`Erro ao enviar: ${errorData.error || 'Erro desconhecido'}`);
            }
        } catch (err) {
            console.error('Send error:', err);
            toastError('Erro ao enviar mensagem');
        } finally {
            setSending(false);
        }
    };

    const resetForm = () => {
        setMode('template');
        setSelectedTemplateId(null);
        setCustomMessage('');
    };

    const handleTemplateClick = (templateId: number) => {
        setSelectedTemplateId(templateId);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2>Enviar Mensagem</h2>
                        <p className={styles.subtitle}>
                            Para: {contact.nome} ({contact.telefone})
                        </p>
                    </div>
                    <button onClick={onClose} className={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    {/* Mode Selection */}
                    <div className={styles.modeSelection}>
                        <label className={styles.modeLabel}>Tipo de Mensagem:</label>
                        <div className={styles.radioGroup}>
                            <label className={styles.radioOption}>
                                <input
                                    type="radio"
                                    name="messageMode"
                                    value="custom"
                                    checked={mode === 'custom'}
                                    onChange={() => setMode('custom')}
                                />
                                <span>Mensagem Livre</span>
                            </label>
                            <label className={styles.radioOption}>
                                <input
                                    type="radio"
                                    name="messageMode"
                                    value="template"
                                    checked={mode === 'template'}
                                    onChange={() => setMode('template')}
                                />
                                <span>Usar Modelo</span>
                            </label>
                        </div>
                    </div>

                    {/* Template Selection */}
                    {mode === 'template' && (
                        <div className={styles.templateSelection}>
                            <label className={styles.fieldLabel}>Selecione o Modelo:</label>
                            {templates.length > 0 ? (
                                <>
                                    <select
                                        value={selectedTemplateId || ''}
                                        onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                                        className={styles.selectBox}
                                    >
                                        <option value="">-- Selecione um modelo --</option>
                                        {templates.map((template) => (
                                            <option key={template.id} value={template.id}>
                                                {template.name} {template.type === 'ai' ? '(IA)' : '(Fixo)'}
                                            </option>
                                        ))}
                                    </select>

                                    {selectedTemplateId && (
                                        <div className={styles.templatePreview}>
                                            <label className={styles.fieldLabel}>Preview da Mensagem:</label>
                                            <div className={styles.previewBox}>
                                                {templates.find(t => t.id === selectedTemplateId)?.message}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className={styles.emptyState}>
                                    <p>Nenhum modelo disponível</p>
                                    <p className={styles.emptyStateHint}>
                                        Crie modelos na página de Modelos
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Custom Message */}
                    {mode === 'custom' && (
                        <div className={styles.customMessage}>
                            <label className={styles.fieldLabel}>Mensagem:</label>
                            <textarea
                                value={customMessage}
                                onChange={(e) => setCustomMessage(e.target.value)}
                                placeholder="Digite sua mensagem personalizada..."
                                rows={10}
                                className={styles.textarea}
                            />
                            <div className={styles.charCount}>
                                {customMessage.length} caracteres
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className={styles.actions}>
                        <button onClick={onClose} className={styles.cancelButton}>
                            Cancelar
                        </button>
                        <button
                            onClick={handleSend}
                            className={styles.sendButton}
                            disabled={sending || !isMessageValid()}
                        >
                            <Send size={16} />
                            {sending ? 'Enviando...' : 'Enviar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
