'use client';

/**
 * Auto-Reply List Component
 * Displays all auto-replies in a table format following system patterns
 */

import type { AutoReply } from '@/types/autoReply';
import { Edit2, Trash2 } from 'lucide-react';
import styles from './AutoReplies.module.css';

interface AutoReplyListProps {
    replies: AutoReply[];
    loading: boolean;
    onEdit: (reply: AutoReply) => void;
    onDelete: (id: number) => void;
    onToggle: (id: number) => void;
}

export function AutoReplyList({ replies, loading, onEdit, onDelete, onToggle }: AutoReplyListProps) {
    if (loading) {
        return (
            <div className={styles.tableContainer}>
                <div className={styles.loading}>Carregando...</div>
            </div>
        );
    }

    if (replies.length === 0) {
        return (
            <div className={styles.tableContainer}>
                <div className={styles.empty}>
                    Nenhuma resposta automática cadastrada
                </div>
            </div>
        );
    }

    return (
        <div className={styles.tableContainer}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Nome / Intenção</th>
                        <th>Resposta</th>
                        <th>Confiança</th>
                        <th>Prioridade</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {replies.map((reply) => (
                        <tr key={reply.id}>
                            <td>
                                <label className={styles.toggle}>
                                    <input
                                        type="checkbox"
                                        checked={reply.is_active}
                                        onChange={() => onToggle(reply.id)}
                                        className={styles.toggleInput}
                                    />
                                    <span className={styles.toggleSlider}></span>
                                </label>
                            </td>
                            <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                                        {reply.name}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {reply.intent_description.length > 80
                                            ? reply.intent_description.substring(0, 80) + '...'
                                            : reply.intent_description
                                        }
                                    </div>
                                    {reply.example_messages && reply.example_messages.length > 0 && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Exemplos: {reply.example_messages.slice(0, 2).join(', ')}
                                            {reply.example_messages.length > 2 && '...'}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td>
                                <div style={{ maxWidth: '300px', fontSize: '0.9rem' }}>
                                    {reply.response_template.length > 100
                                        ? reply.response_template.substring(0, 100) + '...'
                                        : reply.response_template
                                    }
                                </div>
                            </td>
                            <td>
                                <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                                    {(reply.confidence_threshold * 100).toFixed(0)}%
                                </span>
                            </td>
                            <td>
                                <span className={`${styles.badge} ${styles.badgePrimary}`}>
                                    {reply.priority}
                                </span>
                            </td>
                            <td>
                                <div className={styles.actions}>
                                    <button
                                        onClick={() => onEdit(reply)}
                                        className={styles.actionButton}
                                        title="Editar"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => onDelete(reply.id)}
                                        className={styles.actionButton}
                                        title="Deletar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
