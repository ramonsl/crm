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

    useEffect(() => {
        if (isOpen && contact) {
            fetchHistory();
        }
    }, [isOpen, contact]);

    const fetchHistory = async () => {
        if (!contact) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/message-history?cpf=${contact.cpf}`);
            if (response.ok) {
                const data = await response.json();
                setMessages(data.messages || []);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
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
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`${styles.message} ${msg.direction === 'sent' ? styles.sent : styles.received
                                        }`}
                                >
                                    <div className={styles.messageHeader}>
                                        <span className={styles.direction}>
                                            {msg.direction === 'sent' ? 'Enviada' : 'Recebida'}
                                        </span>
                                        <TimeAgoBadge date={msg.timestamp} />
                                    </div>
                                    <div className={styles.messageContent}>{msg.message}</div>
                                    {msg.status && (
                                        <div className={styles.messageStatus}>Status: {msg.status}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
