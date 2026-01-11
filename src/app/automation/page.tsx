'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { Zap, RefreshCw, MessageSquare, Timer, Clock, Users, Play, Pause } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface StatusItem {
    id: number;
    name: string;
    color: string;
}

interface TemplateItem {
    id: number;
    name: string;
    message: string;
}

interface StatusTemplateAssociation {
    id: number;
    status_name: string;
    template_id: number | null;
    is_active: boolean;
    template_name: string | null;
}

interface QueueAutomationConfig {
    templateId: number | null;
    targetStatus: string | null;
    messageType: 'fixed' | 'ai';
    isActive: boolean;
    startHour: number;
    endHour: number;
}

interface QueueAutomationStatus {
    isActive: boolean;
    isRunning: boolean;
    isWithinOperatingHours: boolean;
    currentHourBrazil: number;
    totalSent: number;
    lastSentAt: string | null;
    queueLength: number;
}

export default function AutomationPage() {
    const { success: toastSuccess, error: toastError } = useToast();

    const [statuses, setStatuses] = useState<StatusItem[]>([]);
    const [templates, setTemplates] = useState<TemplateItem[]>([]);
    const [associations, setAssociations] = useState<StatusTemplateAssociation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    // Queue Automation states
    const [queueConfig, setQueueConfig] = useState<QueueAutomationConfig>({
        templateId: null,
        targetStatus: null,
        messageType: 'fixed',
        isActive: false,
        startHour: 8,
        endHour: 21
    });
    const [queueStatus, setQueueStatus] = useState<QueueAutomationStatus | null>(null);
    const [savingQueue, setSavingQueue] = useState(false);

    // Tab State
    const [activeTab, setActiveTab] = useState<'status' | 'queue'>('status');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statusRes, templateRes, assocRes, queueRes] = await Promise.all([
                fetch('/api/statuses'),
                fetch('/api/templates'),
                fetch('/api/status-templates'),
                fetch('/api/automation/queue')
            ]);

            const [statusData, templateData, assocData, queueData] = await Promise.all([
                statusRes.json(),
                templateRes.json(),
                assocRes.json(),
                queueRes.json()
            ]);

            setStatuses(statusData.data || []);
            setTemplates(templateData.data || templateData || []);
            setAssociations(assocData.data || []);

            if (queueData.config) {
                setQueueConfig(queueData.config);
            }
            if (queueData.status) {
                setQueueStatus(queueData.status);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            toastError('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    const handleTemplateChange = async (statusName: string, templateId: number | null) => {
        setSaving(statusName);
        try {
            const res = await fetch('/api/status-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status_name: statusName,
                    template_id: templateId,
                    is_active: true
                })
            });

            if (res.ok) {
                toastSuccess('Configuração salva!');
                loadData();
            } else {
                toastError('Erro ao salvar');
            }
        } catch (error) {
            toastError('Erro ao salvar');
        } finally {
            setSaving(null);
        }
    };

    const handleToggleActive = async (statusName: string, currentActive: boolean) => {
        setSaving(statusName);
        try {
            const assoc = associations.find(a => a.status_name === statusName);
            const res = await fetch('/api/status-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status_name: statusName,
                    template_id: assoc?.template_id || null,
                    is_active: !currentActive
                })
            });

            if (res.ok) {
                toastSuccess(currentActive ? 'Automação desativada' : 'Automação ativada');
                loadData();
            } else {
                toastError('Erro ao atualizar');
            }
        } catch (error) {
            toastError('Erro ao atualizar');
        } finally {
            setSaving(null);
        }
    };

    const getAssociation = (statusName: string) => {
        return associations.find(a => a.status_name === statusName);
    };

    // Queue automation handlers
    const handleQueueTemplateChange = async (templateId: number | null) => {
        setSavingQueue(true);
        try {
            const res = await fetch('/api/automation/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId })
            });

            if (res.ok) {
                const data = await res.json();
                setQueueConfig(data.config);
                toastSuccess('Template atualizado!');
            } else {
                toastError('Erro ao atualizar template');
            }
        } catch (error) {
            toastError('Erro ao atualizar');
        } finally {
            setSavingQueue(false);
        }
    };

    const handleQueueTypeChange = async (messageType: 'fixed' | 'ai') => {
        setSavingQueue(true);
        try {
            const res = await fetch('/api/automation/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageType })
            });

            if (res.ok) {
                const data = await res.json();
                setQueueConfig(data.config);
                toastSuccess('Tipo de mensagem atualizado!');
            } else {
                toastError('Erro ao atualizar');
            }
        } catch (error) {
            toastError('Erro ao atualizar');
        } finally {
            setSavingQueue(false);
        }
    };

    const handleQueueStatusChange = async (targetStatus: string | null) => {
        setSavingQueue(true);
        try {
            const res = await fetch('/api/automation/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetStatus })
            });

            if (res.ok) {
                const data = await res.json();
                setQueueConfig(data.config);
                toastSuccess('Status atualizado!');
            } else {
                toastError('Erro ao atualizar');
            }
        } catch (error) {
            toastError('Erro ao atualizar');
        } finally {
            setSavingQueue(false);
        }
    };

    const handleQueueToggle = async () => {
        if (!queueConfig.templateId) {
            toastError('Selecione um template primeiro');
            return;
        }

        setSavingQueue(true);
        try {
            const res = await fetch('/api/automation/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !queueConfig.isActive })
            });

            if (res.ok) {
                const data = await res.json();
                setQueueConfig(data.config);
                toastSuccess(data.config.isActive ? 'Automação ativada!' : 'Automação desativada');
            } else {
                toastError('Erro ao atualizar');
            }
        } catch (error) {
            toastError('Erro ao atualizar');
        } finally {
            setSavingQueue(false);
        }
    };

    const handlePlayPause = async () => {
        if (!queueConfig.isActive) {
            toastError('Ative a automação primeiro');
            return;
        }

        setSavingQueue(true);
        try {
            const action = queueStatus?.isRunning ? 'stop' : 'start';
            const res = await fetch('/api/automation/queue/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toastSuccess(data.message);
                // Refresh status
                loadData();
            } else {
                toastError(data.message || 'Erro ao processar');
            }
        } catch (error) {
            toastError('Erro ao processar');
        } finally {
            setSavingQueue(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <RefreshCw size={28} className={styles.spin} />
                    <p>Carregando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    <Zap size={22} style={{ color: 'var(--warning)' }} />
                    Automação de Mensagens
                </h1>
                <p className={styles.subtitle}>
                    Configure mensagens automáticas para cada mudança de status
                </p>
            </header>



            {/* Tabs */}
            <div className={styles.tabsContainer}>
                <button
                    className={`${styles.tab} ${activeTab === 'status' ? styles.active : ''}`}
                    onClick={() => setActiveTab('status')}
                >
                    <MessageSquare size={18} />
                    Por Status
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'queue' ? styles.active : ''}`}
                    onClick={() => setActiveTab('queue')}
                >
                    <Timer size={18} />
                    Fila Vazia
                </button>
            </div>

            {/* Status Automation Tab */}
            {
                activeTab === 'status' && (
                    <>
                        <div className={styles.section}>
                            <div className={styles.infoBox}>
                                <p><strong>Como funciona:</strong></p>
                                <p>1. Selecione um template para cada status</p>
                                <p>2. Ative a automação com o toggle</p>
                                <p>3. Quando um lead mudar para esse status, a mensagem será enviada</p>
                                <p className={styles.warning}>
                                    ⚠️ Cada lead só recebe a mensagem <strong>uma vez</strong> por status
                                </p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>
                                <MessageSquare size={18} />
                                Configurar por Status
                            </h2>

                            {statuses.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <MessageSquare size={28} />
                                    <p>Nenhum status cadastrado</p>
                                </div>
                            ) : (
                                <div className={styles.statusList}>
                                    {statuses.map((status) => {
                                        const assoc = getAssociation(status.name);
                                        const isActive = assoc?.is_active ?? false;
                                        const isSaving = saving === status.name;

                                        return (
                                            <div key={status.id} className={styles.statusCard}>
                                                <div className={styles.statusHeader}>
                                                    <span
                                                        className={styles.statusBadge}
                                                        style={{
                                                            backgroundColor: `${status.color}20`,
                                                            color: status.color,
                                                            border: `1px solid ${status.color}`
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                width: 6,
                                                                height: 6,
                                                                borderRadius: '50%',
                                                                backgroundColor: status.color
                                                            }}
                                                        />
                                                        {status.name}
                                                    </span>

                                                    <button
                                                        className={`${styles.switch} ${isActive ? styles.active : ''}`}
                                                        onClick={() => handleToggleActive(status.name, isActive)}
                                                        disabled={isSaving || !assoc?.template_id}
                                                        title={!assoc?.template_id ? 'Selecione um template' : isActive ? 'Desativar' : 'Ativar'}
                                                    />
                                                </div>

                                                <select
                                                    className={styles.select}
                                                    value={assoc?.template_id || ''}
                                                    onChange={(e) => handleTemplateChange(
                                                        status.name,
                                                        e.target.value ? parseInt(e.target.value) : null
                                                    )}
                                                    disabled={isSaving}
                                                >
                                                    <option value="">Nenhum template (não enviar)</option>
                                                    {templates.map((template) => (
                                                        <option key={template.id} value={template.id}>
                                                            {template.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )
            }

            {/* Queue Automation Tab */}
            {
                activeTab === 'queue' && (
                    <>
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>
                                <Timer size={18} />
                                Automação de Fila Vazia
                            </h2>

                            <div className={styles.infoBox}>
                                <p><strong>Como funciona:</strong></p>
                                <p>1. Quando a fila de mensagens esvazia, envia automaticamente para o próximo lead</p>
                                <p>2. Cada lead recebe apenas <strong>uma mensagem</strong> dessa automação</p>
                                <p className={styles.warning}>
                                    ⏰ Funciona apenas entre <strong>{queueConfig.startHour}h e {queueConfig.endHour}h</strong> (horário de Brasília)
                                </p>
                            </div>

                            <div className={styles.statusCard} style={{ marginTop: '1rem' }}>
                                <div className={styles.statusHeader}>
                                    <span className={styles.statusBadge} style={{
                                        backgroundColor: queueConfig.isActive ? 'var(--badge-success-bg)' : 'var(--bg-body)',
                                        color: queueConfig.isActive ? 'var(--badge-success-text)' : 'var(--text-muted)',
                                        border: `1px solid ${queueConfig.isActive ? 'var(--badge-success-border)' : 'var(--border-color)'}`
                                    }}>
                                        <Timer size={14} />
                                        Fila Vazia
                                        {queueStatus?.isRunning && (
                                            <span style={{
                                                marginLeft: '0.5rem',
                                                fontSize: '0.65rem',
                                                backgroundColor: 'var(--badge-success-bg)',
                                                color: 'var(--badge-success-text)',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--badge-success-border)'
                                            }}>
                                                ENVIANDO
                                            </span>
                                        )}
                                    </span>

                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        {/* Play/Pause Button */}
                                        <button
                                            onClick={handlePlayPause}
                                            disabled={savingQueue || !queueConfig.isActive}
                                            title={queueStatus?.isRunning ? 'Pausar envios' : 'Iniciar envios'}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '50%',
                                                border: 'none',
                                                cursor: queueConfig.isActive ? 'pointer' : 'not-allowed',
                                                backgroundColor: queueStatus?.isRunning
                                                    ? 'var(--warning)'
                                                    : queueConfig.isActive
                                                        ? 'var(--success)'
                                                        : 'var(--border-color)',
                                                color: 'white',
                                                opacity: savingQueue ? 0.6 : 1,
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {queueStatus?.isRunning ? <Pause size={16} /> : <Play size={16} />}
                                        </button>

                                        {/* Toggle Switch */}
                                        <button
                                            className={`${styles.switch} ${queueConfig.isActive ? styles.active : ''}`}
                                            onClick={handleQueueToggle}
                                            disabled={savingQueue || !queueConfig.templateId}
                                            title={!queueConfig.templateId ? 'Selecione um template' : queueConfig.isActive ? 'Desativar' : 'Ativar'}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>
                                            Status do Lead
                                        </label>
                                        <select
                                            className={styles.select}
                                            value={queueConfig.targetStatus || ''}
                                            onChange={(e) => handleQueueStatusChange(
                                                e.target.value || null
                                            )}
                                            disabled={savingQueue}
                                        >
                                            <option value="">Todos os status</option>
                                            {statuses.map((status) => (
                                                <option key={status.id} value={status.name}>
                                                    {status.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ flex: 2 }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>
                                            Template
                                        </label>
                                        <select
                                            className={styles.select}
                                            value={queueConfig.templateId || ''}
                                            onChange={(e) => handleQueueTemplateChange(
                                                e.target.value ? parseInt(e.target.value) : null
                                            )}
                                            disabled={savingQueue}
                                        >
                                            <option value="">Selecione um template</option>
                                            {templates.map((template) => (
                                                <option key={template.id} value={template.id}>
                                                    {template.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Status Info */}
                                {queueStatus && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '1rem',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        borderTop: '1px solid var(--border-color)',
                                        paddingTop: '0.75rem',
                                        marginTop: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Clock size={12} />
                                            <span>Hora Brasília: {queueStatus.currentHourBrazil}h</span>
                                            {queueStatus.isWithinOperatingHours ? (
                                                <span style={{ color: 'var(--success)' }}>(ativo)</span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>(fora do horário)</span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Users size={12} />
                                            <span>Enviadas: {queueStatus.totalSent}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )
            }
        </div >
    );
}
