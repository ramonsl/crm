/**
 * ActivityTimeline - Modal for viewing activity timeline
 * 
 * Displays chronological list of all interactions with a contact
 * Follows existing component patterns (HistoryModal)
 */

'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, RefreshCw, FileText, UserPlus, ArrowRightLeft, StickyNote, ChevronDown, ChevronRight } from 'lucide-react';
import TimeAgoBadge from '@/components/TimeAgoBadge';
import type { Contact } from '@/types/contacts';
import styles from './ActivityTimeline.module.css';

interface Activity {
    id: number | string;
    contact_cpf: string;
    type: 'whatsapp' | 'status_change' | 'note' | 'lead_created' | 'lead_updated';
    subtype: 'sent' | 'received' | 'template' | null;
    title: string;
    description: string | null;
    metadata: string | null;
    created_at: string;
}

interface ActivityTimelineProps {
    contact: Contact | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ActivityTimeline({ contact, isOpen, onClose }: ActivityTimelineProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(false);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Set<string | number>>(new Set());

    useEffect(() => {
        if (isOpen && contact) {
            fetchActivities();
            setExpandedItems(new Set()); // Reset expanded state when opening
        }
    }, [isOpen, contact]);

    const fetchActivities = async () => {
        if (!contact) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/activities?cpf=${encodeURIComponent(contact.cpf)}&limit=100`);

            if (response.ok) {
                const data = await response.json();
                setActivities(data.data || []);
                console.log(`[ActivityTimeline] Loaded ${data.data?.length || 0} activities`);
            } else {
                console.error('[ActivityTimeline] API error:', await response.text());
            }
        } catch (error) {
            console.error('[ActivityTimeline] Error fetching activities:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contact || !note.trim()) return;

        setSubmitting(true);
        try {
            const response = await fetch('/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cpf: contact.cpf,
                    note: note.trim(),
                }),
            });

            if (response.ok) {
                setNote('');
                fetchActivities(); // Refresh list
            }
        } catch (error) {
            console.error('[ActivityTimeline] Error adding note:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleExpand = (id: string | number) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const getIcon = (type: Activity['type']) => {
        switch (type) {
            case 'whatsapp':
                return <MessageSquare size={12} />;
            case 'status_change':
                return <ArrowRightLeft size={12} />;
            case 'note':
                return <StickyNote size={12} />;
            case 'lead_created':
                return <UserPlus size={12} />;
            case 'lead_updated':
                return <FileText size={12} />;
            default:
                return <FileText size={12} />;
        }
    };

    const getIconClass = (type: Activity['type']) => {
        switch (type) {
            case 'whatsapp':
                return styles.iconWhatsapp;
            case 'status_change':
                return styles.iconStatus;
            case 'note':
                return styles.iconNote;
            case 'lead_created':
            case 'lead_updated':
                return styles.iconLead;
            default:
                return styles.iconNote;
        }
    };

    const getSubtypeBadge = (subtype: Activity['subtype']) => {
        if (!subtype) return null;

        const badgeClass = {
            sent: styles.badgeSent,
            received: styles.badgeReceived,
            template: styles.badgeTemplate,
        }[subtype];

        const label = {
            sent: 'Enviado',
            received: 'Recebido',
            template: 'Template',
        }[subtype];

        return <span className={`${styles.subtypeBadge} ${badgeClass}`}>{label}</span>;
    };

    // Check if activity has expandable content (WhatsApp messages)
    const hasExpandableContent = (activity: Activity) => {
        return activity.type === 'whatsapp' && activity.description;
    };

    if (!isOpen || !contact) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2>Timeline de Atividades</h2>
                        <p className={styles.subtitle}>
                            {contact.nome}
                        </p>
                    </div>
                    <button onClick={onClose} className={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    {loading ? (
                        <div className={styles.loading}>
                            <RefreshCw className="animate-spin" size={20} />
                            <span style={{ marginLeft: '0.5rem' }}>Carregando...</span>
                        </div>
                    ) : activities.length === 0 ? (
                        <div className={styles.empty}>
                            <FileText size={48} />
                            <p>Nenhuma atividade registrada</p>
                        </div>
                    ) : (
                        <div className={styles.timeline}>
                            {activities.map((activity) => {
                                const isExpanded = expandedItems.has(activity.id);
                                const canExpand = hasExpandableContent(activity);

                                return (
                                    <div
                                        key={activity.id}
                                        className={`${styles.activity} ${canExpand ? styles.expandable : ''}`}
                                        onClick={() => canExpand && toggleExpand(activity.id)}
                                    >
                                        <div className={`${styles.activityIcon} ${getIconClass(activity.type)}`}>
                                            {getIcon(activity.type)}
                                        </div>
                                        <div className={styles.activityHeader}>
                                            <span className={styles.activityTitle}>
                                                {activity.title}
                                                {getSubtypeBadge(activity.subtype)}
                                            </span>
                                            <div className={styles.headerRight}>
                                                <TimeAgoBadge date={activity.created_at} />
                                                {canExpand && (
                                                    <span className={styles.expandIcon}>
                                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* For non-WhatsApp: always show description */}
                                        {activity.type !== 'whatsapp' && activity.description && (
                                            <p className={styles.activityDescription}>
                                                {activity.description}
                                            </p>
                                        )}

                                        {/* For WhatsApp: show in dropdown */}
                                        {activity.type === 'whatsapp' && isExpanded && activity.description && (
                                            <div className={styles.messageDropdown}>
                                                <p className={styles.messageContent}>
                                                    {activity.description}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <form className={styles.noteForm} onSubmit={handleAddNote}>
                    <input
                        type="text"
                        className={styles.noteInput}
                        placeholder="Adicionar uma nota..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                    <button
                        type="submit"
                        className={styles.noteButton}
                        disabled={submitting || !note.trim()}
                    >
                        {submitting ? 'Salvando...' : 'Adicionar'}
                    </button>
                </form>
            </div>
        </div>
    );
}
