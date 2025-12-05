'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { MessageSquare, MoreHorizontal, Phone, Calendar, RefreshCw, X, Send } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

export default function KanbanPage() {
    const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [availableStatuses, setAvailableStatuses] = useState<string[]>(['NOVO', 'INSCRITO', 'APROVADO', 'MATRICULADO', 'PENDENTE', 'CANCELADO']);
    const [waStatus, setWaStatus] = useState<'disconnected' | 'initializing' | 'ready'>('disconnected');

    // Message Modal State
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateType, setSelectedTemplateType] = useState<string>('fixed');

    // Import tracking filters
    const [showOnlyNew, setShowOnlyNew] = useState(false);
    const [showOnlyStatusChanged, setShowOnlyStatusChanged] = useState(false);
    const [clearingMarkers, setClearingMarkers] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Filters to get all statuses
                const filterRes = await fetch('/api/filters');
                const filterData = await filterRes.json();
                if (filterData.statuses) {
                    setAvailableStatuses(prev => Array.from(new Set([...prev, ...filterData.statuses])));
                }

                // Fetch All Leads (limit 1000 for now to populate board)
                const leadsRes = await fetch('/api/leads?limit=1000&status=all');
                const leadsData = await leadsRes.json();
                if (leadsData.data) {
                    setLeads(leadsData.data);
                }

                // Fetch Templates
                const templatesRes = await fetch('/api/templates');
                const templatesData = await templatesRes.json();
                setTemplates(templatesData);

            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/whatsapp');
                const data = await res.json();
                setWaStatus(data.status);
            } catch (error) {
                console.error(error);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    const getLeadsByStatus = (status: string) => {
        let filtered = leads.filter(l => l.status?.toUpperCase() === status.toUpperCase());

        // Apply import tracking filters
        if (showOnlyNew) {
            filtered = filtered.filter(l => l.is_new === 1);
        }
        if (showOnlyStatusChanged) {
            filtered = filtered.filter(l => l.status_changed === 1);
        }

        return filtered;
    };

    const handleClearMarkers = async () => {
        if (!confirm('Deseja limpar todas as marcações de "Novo" e "Status Alterado"?')) {
            return;
        }

        setClearingMarkers(true);
        try {
            const res = await fetch('/api/leads/clear-markers', {
                method: 'POST'
            });

            const data = await res.json();

            if (res.ok) {
                toastSuccess(data.message || 'Marcações limpas com sucesso!');

                // Refresh leads data
                const leadsRes = await fetch('/api/leads?limit=1000&status=all');
                const leadsData = await leadsRes.json();
                if (leadsData.data) {
                    setLeads(leadsData.data);
                }
            } else {
                toastError('Erro ao limpar marcações.');
            }
        } catch (error) {
            console.error('Error clearing markers:', error);
            toastError('Erro ao limpar marcações.');
        } finally {
            setClearingMarkers(false);
        }
    };

    const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const templateId = e.target.value;
        if (!templateId) return;

        const template = templates.find(t => t.id.toString() === templateId);
        if (template) {
            setMessage(template.content);
            setSelectedTemplateType(template.type || 'fixed');
        }
    };

    const handleSendMessage = async () => {
        if (!message.trim() || !selectedStatus) return;

        setSending(true);
        const recipients = getLeadsByStatus(selectedStatus);

        if (recipients.length === 0) {
            toastWarning('Nenhum destinatário neste status.');
            setSending(false);
            return;
        }

        try {
            const messages = recipients.map(r => ({
                phone: r.telefone,
                name: r.nome,
                message: message,
                isAi: selectedTemplateType === 'ai_prompt'
            }));

            const res = await fetch('/api/whatsapp/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages })
            });

            if (res.ok) {
                toastSuccess('Mensagens adicionadas à fila de envio! Acompanhe o progresso na aba WhatsApp.');
                setSelectedStatus(null);
                setMessage('');
            } else {
                toastError('Erro ao adicionar à fila.');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            toastError('Erro ao enviar.');
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <RefreshCw className={styles.spin} size={32} />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Quadro Kanban</h1>
                    <p className={styles.subtitle}>Visualize e gerencie seus leads por status</p>
                </div>
                <div className={styles.filterSection}>
                    <label className={styles.filterCheckbox}>
                        <input
                            type="checkbox"
                            checked={showOnlyNew}
                            onChange={(e) => setShowOnlyNew(e.target.checked)}
                        />
                        <span>Mostrar apenas novos</span>
                    </label>
                    <label className={styles.filterCheckbox}>
                        <input
                            type="checkbox"
                            checked={showOnlyStatusChanged}
                            onChange={(e) => setShowOnlyStatusChanged(e.target.checked)}
                        />
                        <span>Mostrar apenas com status alterado</span>
                    </label>
                    <button
                        className={styles.clearButton}
                        onClick={handleClearMarkers}
                        disabled={clearingMarkers}
                    >
                        {clearingMarkers ? <RefreshCw className={styles.spin} size={16} /> : <X size={16} />}
                        <span>Limpar Marcações</span>
                    </button>
                </div>
            </header>

            <div className={styles.boardContainer}>
                {availableStatuses.map(status => {
                    const statusLeads = getLeadsByStatus(status);
                    return (
                        <div key={status} className={`${styles.column} ${styles[status.toLowerCase()] || ''}`}>
                            <div className={styles.columnHeader}>
                                <div className={styles.columnTitle}>
                                    <span className={styles.statusIndicator}></span>
                                    {status}
                                    <span className={styles.countBadge}>{statusLeads.length}</span>
                                </div>
                                <div className={styles.columnActions}>
                                    <button
                                        className={styles.actionButton}
                                        onClick={() => setSelectedStatus(status)}
                                        title={`Send message to all ${status} leads`}
                                        disabled={waStatus !== 'ready' || statusLeads.length === 0}
                                    >
                                        <MessageSquare size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className={styles.cardList}>
                                {statusLeads.map(lead => (
                                    <div key={lead.cpf} className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <span className={styles.cardName}>{lead.nome}</span>
                                            <div className={styles.cardBadges}>
                                                {lead.is_new === 1 && (
                                                    <span className={`${styles.badge} ${styles.badgeNew}`}>NOVO</span>
                                                )}
                                                {lead.status_changed === 1 && (
                                                    <span className={`${styles.badge} ${styles.badgeChanged}`}>STATUS ALTERADO</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.cardPhone}>
                                            <Phone size={12} />
                                            {lead.telefone}
                                        </div>
                                        <div className={styles.cardFooter}>
                                            <span className={styles.cardSemester}>{lead.tipo_ingresso}</span>
                                            <span className={styles.cardDate}>
                                                {new Date(lead.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {statusLeads.length === 0 && (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '1rem', fontSize: '0.875rem' }}>
                                        No leads
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bulk Message Modal */}
            {selectedStatus && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3>Enviar para {selectedStatus}</h3>
                            <button type="button" onClick={() => setSelectedStatus(null)} className={styles.closeButton}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.bulkInfo}>
                                <p>Você está prestes a enviar uma mensagem para <strong>{getLeadsByStatus(selectedStatus).length}</strong> leads em <strong>{selectedStatus}</strong>.</p>
                                <p className={styles.warningText}>Certifique-se de que sua mensagem é genérica o suficiente para todos os destinatários.</p>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Modelo de Mensagem</label>
                                <select className={styles.messageInput} onChange={handleTemplateSelect} defaultValue="" style={{ marginBottom: '1rem' }}>
                                    <option value="">Selecione um modelo...</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.title}</option>
                                    ))}
                                </select>

                                <label>Message</label>
                                <textarea
                                    className={styles.messageInput}
                                    rows={5}
                                    placeholder="Digite sua mensagem aqui..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                />
                            </div>

                            <div className={styles.modalFooter}>
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => setSelectedStatus(null)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className={styles.primaryButton}
                                    onClick={handleSendMessage}
                                    disabled={sending || !message.trim()}
                                >
                                    {sending ? <RefreshCw className={styles.spin} size={18} /> : <Send size={18} />}
                                    <span>{sending ? 'Enviando...' : 'Enviar Mensagem'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
