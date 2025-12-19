'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { Zap, RefreshCw, MessageSquare, Info } from 'lucide-react';
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

export default function AutomationPage() {
    const { success: toastSuccess, error: toastError } = useToast();

    const [statuses, setStatuses] = useState<StatusItem[]>([]);
    const [templates, setTemplates] = useState<TemplateItem[]>([]);
    const [associations, setAssociations] = useState<StatusTemplateAssociation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statusRes, templateRes, assocRes] = await Promise.all([
                fetch('/api/statuses'),
                fetch('/api/templates'),
                fetch('/api/status-templates')
            ]);

            const [statusData, templateData, assocData] = await Promise.all([
                statusRes.json(),
                templateRes.json(),
                assocRes.json()
            ]);

            setStatuses(statusData.data || []);
            setTemplates(templateData.data || templateData || []);
            setAssociations(assocData.data || []);
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

            {/* Info Box */}
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

            {/* Status Cards */}
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
        </div>
    );
}
