/**
 * HistoryModal - Modal for viewing message history
 */

'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare } from 'lucide-react';
import TimeAgoBadge from '@/components/TimeAgoBadge';
import type { Contact } from '@/types/contacts';
import styles from './HistoryModal.module.css';

interface Message {
    id: number;
    contact_cpf: string;
    message: string;
    template_name?: string; // Nome do template enviado
    direction: 'sent' | 'received';
    timestamp: string;
    status?: string;
}

interface HistoryModalProps {
    contact: Contact | null;
    isOpen: boolean;
    onClose: () => void;
}

export function HistoryModal({ contact, isOpen, onClose }: HistoryModalProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (isOpen && contact) {
            fetchHistory();
        }
    }, [isOpen, contact]);

    const toggleMessage = (messageId: number) => {
        setExpandedMessages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return newSet;
        });
    };

    const fetchHistory = async () => {
        if (!contact) return;

        setLoading(true);
        try {
            // Use phone number instead of CPF
            const phone = contact.telefone;
            const response = await fetch(`/api/message-history?phone=${encodeURIComponent(phone)}`);

            if (response.ok) {
                const data = await response.json();
                setMessages(data.messages || []);
                console.log(`[HistoryModal] Loaded ${data.messages?.length || 0} messages`);
            } else {
                console.error('[HistoryModal] API error:', await response.text());
            }
        } catch (error) {
            console.error('[HistoryModal] Error fetching history:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !contact) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2>Histórico de Mensagens</h2>
                        <p className={styles.subtitle}>
                            {contact.nome} ({contact.telefone})
                        </p>
                    </div>
                    <button onClick={onClose} className={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    {loading ? (
                        <div className={styles.loading}>Carregando histórico...</div>
                    ) : messages.length === 0 ? (
                        <div className={styles.empty}>
                            <MessageSquare size={48} />
                            <p>Nenhuma mensagem encontrada</p>
                        </div>
                    ) : (
                        <div className={styles.messageList}>
                            {messages.map((msg) => {
                                const isExpanded = expandedMessages.has(msg.id);

                                return (
                                    <div
                                        key={msg.id}
                                        className={`${styles.message} ${msg.direction === 'sent' ? styles.sent : styles.received}`}
                                    >
                                        <div
                                            className={styles.messageHeader}
                                            onClick={() => toggleMessage(msg.id)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className={styles.headerLeft}>
                                                <span className={styles.direction}>
                                                    {msg.direction === 'sent' ? 'Enviada' : 'Recebida'}
                                                    {msg.template_name && (
                                                        <span className={styles.templateBadge}>
                                                            📄 {msg.template_name}
                                                        </span>
                                                    )}
                                                </span>
                                                <TimeAgoBadge date={msg.timestamp} />
                                            </div>
                                            <span className={styles.expandIcon}>
                                                {isExpanded ? '▼' : '▶'}
                                            </span>
                                        </div>

                                        {isExpanded && (
                                            <>
                                                <div className={styles.messageContent}>{msg.message}</div>
                                                {msg.status && (
                                                    <div className={styles.messageStatus}>Status: {msg.status}</div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
