/**
 * BulkMessageModal - Modal for sending WhatsApp messages to multiple contacts
 * 
 * Supports both local templates (WhatsAppJS) and YCloud templates.
 * Provider is determined by the template type selected.
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Send, AlertCircle, Cloud, MessageSquare } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useTemplates } from '@/hooks/useTemplates';
import type { Contact } from '@/types/contacts';
import type { YCloudTemplateRow } from '@/lib/repositories/YCloudTemplateRepository';
import styles from './MessageModal.module.css';

interface BulkMessageModalProps {
    contacts: Contact[];
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

type MessageMode = 'template' | 'ycloud' | 'custom';

interface TemplateVariable {
    position: number;
    field: string;
    sample: string;
    value?: string;
}

export function BulkMessageModal({ contacts, isOpen, onClose, onComplete }: BulkMessageModalProps) {
    const { success, error: toastError } = useToast();
    const [mode, setMode] = useState<MessageMode>('template');
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [selectedYCloudTemplateId, setSelectedYCloudTemplateId] = useState<number | null>(null);
    const [customMessage, setCustomMessage] = useState('');
    const [sending, setSending] = useState(false);
    const { templates } = useTemplates();

    // YCloud templates state
    const [yCloudTemplates, setYCloudTemplates] = useState<YCloudTemplateRow[]>([]);
    const [loadingYCloud, setLoadingYCloud] = useState(false);
    const [variableValues, setVariableValues] = useState<Record<number, string>>({});

    // Load YCloud templates
    useEffect(() => {
        if (isOpen) {
            setLoadingYCloud(true);
            setLoadingYCloud(true);
            fetch('/api/ycloud/templates')
                .then(res => res.json())
                .then(data => {
                    // Only show approved templates
                    const approved = (data.data || []).filter(
                        (t: YCloudTemplateRow) => t.status === 'approved'
                    );
                    setYCloudTemplates(approved);
                })
                .catch(err => console.error('Error loading YCloud templates:', err))
                .finally(() => setLoadingYCloud(false));
        }
    }, [isOpen]);

    if (!isOpen || contacts.length === 0) return null;

    const selectedYCloudTemplate = yCloudTemplates.find(t => t.id === selectedYCloudTemplateId);
    const templateVariables: TemplateVariable[] = selectedYCloudTemplate?.variables
        ? (selectedYCloudTemplate.variables as TemplateVariable[])
        : [];

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
        if (mode === 'ycloud') {
            if (!selectedYCloudTemplateId) return false;
            // Check if all variables have values
            return templateVariables.every(v => variableValues[v.position]?.trim());
        }
        return customMessage.trim().length > 0;
    };

    const handleSend = async () => {
        setSending(true);

        try {
            if (mode === 'ycloud') {
                // Send via YCloud provider
                await sendViaYCloud();
            } else {
                // Send via WhatsAppJS (local templates or custom)
                await sendViaWhatsAppJS();
            }
        } catch (err) {
            console.error('Queue error:', err);
            toastError('Erro ao adicionar mensagens à fila');
        } finally {
            setSending(false);
        }
    };

    const sendViaYCloud = async () => {
        if (!selectedYCloudTemplate) {
            toastError('Selecione um template YCloud');
            return;
        }

        // Build variable values for each contact
        const messages = contacts.map(contact => {
            // Replace field references with contact values
            const variables = templateVariables.map(v => {
                // Get the value from user input or use sample/default
                let value = variableValues[v.position] || v.sample || '';

                // If value is still a placeholder or empty, try to auto-fill from contact
                if (!value || value.includes('{{')) {
                    // Auto-fill based on field mapping
                    if (v.field === 'nome' || value.includes('{{nome}}')) {
                        value = contact.nome || '';
                    } else if (v.field === 'telefone' || value.includes('{{telefone}}')) {
                        value = contact.telefone || '';
                    } else if (v.field === 'email' || value.includes('{{email}}')) {
                        value = contact.email || '';
                    }
                }

                // Replace any remaining placeholders
                value = value.replace(/\{\{nome\}\}/gi, contact.nome || '');
                value = value.replace(/\{\{telefone\}\}/gi, contact.telefone || '');
                value = value.replace(/\{\{email\}\}/gi, contact.email || '');

                return { position: v.position, value };
            });

            return {
                phone: contact.telefone,
                name: contact.nome,
                cpf: contact.cpf,
                templateName: selectedYCloudTemplate.template_name,
                templateId: selectedYCloudTemplate.id,
                variables,
                provider: 'ycloud' as const
            };
        });

        const response = await fetch('/api/whatsapp/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
        });

        if (response.ok) {
            success(`✅ ${contacts.length} mensagem(ns) YCloud adicionada(s) à fila!`);
            resetForm();
            onComplete();
            onClose();
        } else {
            const errorData = await response.json();
            toastError(`Erro: ${errorData.error || 'Erro desconhecido'}`);
        }
    };

    const sendViaWhatsAppJS = async () => {
        const baseMessage = getMessageToSend();
        const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
        const isAITemplate = mode === 'template' && selectedTemplate?.type === 'ai';

        if (!baseMessage.trim()) {
            toastError(mode === 'template' ? 'Selecione um modelo' : 'Digite uma mensagem');
            return;
        }

        const messages = contacts.map(contact => ({
            phone: contact.telefone,
            name: contact.nome,
            cpf: contact.cpf,
            message: baseMessage,
            isAi: isAITemplate,
            templateId: selectedTemplateId || undefined,
            templateName: selectedTemplate?.name,
            provider: 'whatsappjs' as const
        }));

        const response = await fetch('/api/whatsapp/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
        });

        if (response.ok) {
            success(`✅ ${contacts.length} mensagem(ns) adicionada(s) à fila!`);
            resetForm();
            onComplete();
            onClose();
        } else {
            const errorData = await response.json();
            toastError(`Erro: ${errorData.error || 'Erro desconhecido'}`);
        }
    };

    const resetForm = () => {
        setMode('template');
        setSelectedTemplateId(null);
        setSelectedYCloudTemplateId(null);
        setCustomMessage('');
        setVariableValues({});
    };

    const handleYCloudTemplateChange = (id: number | null) => {
        setSelectedYCloudTemplateId(id);
        setVariableValues({});
    };

    // Preview message with variables replaced
    const getYCloudPreview = (): string => {
        if (!selectedYCloudTemplate) return '';
        let preview = selectedYCloudTemplate.body_text;
        templateVariables.forEach(v => {
            const value = variableValues[v.position] || `{{${v.position}}}`;
            preview = preview.replace(`{{${v.position}}}`, value);
        });
        return preview;
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

                    {/* Mode Selection - Now with 3 options */}
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
                                <MessageSquare size={14} />
                                <span>Livre</span>
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
                                <MessageSquare size={14} />
                                <span>Modelo Local</span>
                            </label>
                            <label className={styles.radioOption} style={{
                                opacity: yCloudTemplates.length === 0 ? 0.5 : 1
                            }}>
                                <input
                                    type="radio"
                                    name="messageMode"
                                    value="ycloud"
                                    checked={mode === 'ycloud'}
                                    onChange={() => setMode('ycloud')}
                                    disabled={sending || yCloudTemplates.length === 0}
                                />
                                <Cloud size={14} />
                                <span>YCloud</span>
                            </label>
                        </div>
                    </div>

                    {/* Local Template Selection */}
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
                                            <label className={styles.fieldLabel}>Preview:</label>
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

                    {/* YCloud Template Selection */}
                    {mode === 'ycloud' && (
                        <div className={styles.templateSelection}>
                            <label className={styles.fieldLabel}>
                                <Cloud size={14} style={{ marginRight: '0.5rem' }} />
                                Template YCloud (Aprovado):
                            </label>
                            {loadingYCloud ? (
                                <p style={{ color: 'var(--text-muted)' }}>Carregando templates...</p>
                            ) : yCloudTemplates.length > 0 ? (
                                <>
                                    <select
                                        value={selectedYCloudTemplateId || ''}
                                        onChange={(e) => handleYCloudTemplateChange(Number(e.target.value) || null)}
                                        className={styles.selectBox}
                                        disabled={sending}
                                    >
                                        <option value="">-- Selecione um template --</option>
                                        {yCloudTemplates.map((template) => (
                                            <option key={template.id} value={template.id}>
                                                {template.friendly_name} ({template.category})
                                            </option>
                                        ))}
                                    </select>

                                    {selectedYCloudTemplate && (
                                        <div className={styles.templatePreview}>
                                            <div className={styles.aiInfo} style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                                                <Cloud size={14} />
                                                <span>
                                                    Enviado via YCloud API (WhatsApp Business)
                                                </span>
                                            </div>

                                            {/* Variable Inputs */}
                                            {templateVariables.length > 0 && (
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label className={styles.fieldLabel}>Variáveis:</label>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {templateVariables.map(v => (
                                                            <div key={v.position} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                                <span style={{ minWidth: '80px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                                    {`{{${v.position}}}`}:
                                                                </span>
                                                                <input
                                                                    type="text"
                                                                    value={variableValues[v.position] || ''}
                                                                    onChange={(e) => setVariableValues(prev => ({
                                                                        ...prev,
                                                                        [v.position]: e.target.value
                                                                    }))}
                                                                    placeholder={v.sample || `Variável ${v.position}`}
                                                                    className={styles.selectBox}
                                                                    style={{ flex: 1 }}
                                                                    disabled={sending}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                        Use {"{{nome}}"}, {"{{telefone}}"}, {"{{email}}"} para dados do contato
                                                    </p>
                                                </div>
                                            )}

                                            <label className={styles.fieldLabel}>Preview:</label>
                                            <div className={styles.previewBox}>
                                                {getYCloudPreview()}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className={styles.emptyState}>
                                    <p>Nenhum template YCloud aprovado</p>
                                    <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                                        Crie e aprove templates em Configurações &gt; YCloud
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
                            style={mode === 'ycloud' ? { background: 'var(--info)' } : {}}
                        >
                            {mode === 'ycloud' && <Cloud size={16} />}
                            {mode !== 'ycloud' && <Send size={16} />}
                            {sending ? 'Adicionando à fila...' : `Enviar para ${contacts.length}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

