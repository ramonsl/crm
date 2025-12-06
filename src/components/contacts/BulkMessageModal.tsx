/**
 * BulkMessageModal - Modal for sending WhatsApp messages to multiple contacts
 */

'use client';

import { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useTemplates } from '@/hooks/useTemplates';
import type { Contact } from '@/types/contacts';
import styles from './MessageModal.module.css';

interface BulkMessageModalProps {
    contacts: Contact[];
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

type MessageMode = 'template' | 'custom';

export function BulkMessageModal({ contacts, isOpen, onClose, onComplete }: BulkMessageModalProps) {
    const { success, error: toastError } = useToast();
    const [mode, setMode] = useState<MessageMode>('template');
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [customMessage, setCustomMessage] = useState('');
    const [sending, setSending] = useState(false);
    const { templates } = useTemplates();

    if (!isOpen || contacts.length === 0) return null;

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
        const baseMessage = getMessageToSend();
        const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
        const isAITemplate = mode === 'template' && selectedTemplate?.type === 'ai';

        if (!baseMessage.trim()) {
            toastError(mode === 'template' ? 'Selecione um modelo' : 'Digite uma mensagem');
            return;
        }

        setSending(true);

        try {
            // Build messages array for the queue
            const messages = contacts.map(contact => ({
                phone: contact.telefone,
                name: contact.nome,
                cpf: contact.cpf,
                message: baseMessage,
                isAi: isAITemplate,
                templateId: selectedTemplateId || undefined,
                templateName: selectedTemplate?.name
            }));

            // Send to server-side queue
            const response = await fetch('/api/whatsapp/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages })
            });

            if (response.ok) {
                success(`✅ ${contacts.length} mensagem(ns) adicionada(s) à fila! Acompanhe o progresso na aba WhatsApp.`);
                resetForm();
                onComplete();
                onClose();
            } else {
                const errorData = await response.json();
                toastError(`Erro ao adicionar à fila: ${errorData.error || 'Erro desconhecido'}`);
            }
        } catch (err) {
            console.error('Queue error:', err);
            toastError('Erro ao adicionar mensagens à fila');
        } finally {
            setSending(false);
        }
    };

    const resetForm = () => {
        setMode('template');
        setSelectedTemplateId(null);
        setCustomMessage('');
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2>Enviar Mensagem em Massa</h2>
                        <p className={styles.subtitle}>
                            Para {contacts.length} contato(s) selecionado(s)
                        </p>
                    </div>
                    <button onClick={onClose} className={styles.closeButton} disabled={sending}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    {/* Warning */}
                    <div className={styles.warningBox}>
                        <AlertCircle size={16} />
                        <span>
                            As mensagens serão adicionadas à fila e enviadas em segundo plano.
                            Você pode fechar esta janela e acompanhar o progresso na aba WhatsApp.
                        </span>
                    </div>

                    {/* Recipients Preview */}
                    <div className={styles.recipientsPreview}>
                        <label className={styles.fieldLabel}>Destinatários:</label>
                        <div className={styles.recipientsList}>
                            {contacts.slice(0, 5).map(contact => (
                                <div key={contact.cpf} className={styles.recipientItem}>
                                    {contact.nome} ({contact.telefone})
                                </div>
                            ))}
                            {contacts.length > 5 && (
                                <div className={styles.recipientMore}>
                                    +{contacts.length - 5} outro(s)
                                </div>
                            )}
                        </div>
                    </div>

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
                                    disabled={sending}
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
                                    disabled={sending}
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
                                        disabled={sending}
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
                                            {templates.find(t => t.id === selectedTemplateId)?.type === 'ai' && (
                                                <div className={styles.aiInfo}>
                                                    <AlertCircle size={14} />
                                                    <span>
                                                        Template de IA: Uma mensagem única será gerada para cada contato
                                                    </span>
                                                </div>
                                            )}
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
                                rows={8}
                                className={styles.textarea}
                                disabled={sending}
                            />
                            <div className={styles.charCount}>
                                {customMessage.length} caracteres
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className={styles.actions}>
                        <button
                            onClick={onClose}
                            className={styles.cancelButton}
                            disabled={sending}
                        >
                            {sending ? 'Aguarde...' : 'Cancelar'}
                        </button>
                        <button
                            onClick={handleSend}
                            className={styles.sendButton}
                            disabled={sending || !isMessageValid()}
                        >
                            <Send size={16} />
                            {sending ? 'Adicionando à fila...' : `Enviar para ${contacts.length}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
