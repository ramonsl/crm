'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Save, RefreshCw, Briefcase, ExternalLink, AlertCircle,
    CheckCircle2, Users, Loader2, Globe
} from 'lucide-react';
import styles from './Settings.module.css';

interface WhatsAppGroup {
    id: string;
    subject: string;
    participants?: { id: string }[];
}

export function LinkedInSettings() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncLogs, setSyncLogs] = useState<string[]>([]);
    const [stats, setStats] = useState({ total: 0, posted: 0, error: 0 });
    const [latestJobs, setLatestJobs] = useState<Record<string, unknown>[]>([]);
    const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [groupsError, setGroupsError] = useState<string | null>(null);

    // Remotar settings
    const [remotarEnabled, setRemotarEnabled] = useState(false);
    const [remotarCategories, setRemotarCategories] = useState('2,3,4,7,10,12,15,13,14,8');
    const [remotarHours, setRemotarHours] = useState(48);

    // VagasRemotas settings
    const [vagasRemotasEnabled, setVagasRemotasEnabled] = useState(false);

    // Workei settings
    const [workeiEnabled, setWorkeiEnabled] = useState(false);

    const [groupId, setGroupId] = useState('');

    const fetchGroups = useCallback(async () => {
        setLoadingGroups(true);
        setGroupsError(null);
        try {
            const res = await fetch('/api/whatsapp/groups?action=list');
            const data = await res.json();
            if (data.success && Array.isArray(data.groups)) {
                setGroups(data.groups);
            } else {
                setGroupsError(data.error || 'Não foi possível carregar os grupos.');
            }
        } catch (err) {
            console.error('Error fetching WhatsApp groups:', err);
            setGroupsError('Erro de conexão. Verifique se o WhatsApp está conectado.');
        } finally {
            setLoadingGroups(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
        fetchStats();
        fetchGroups();
    }, [fetchGroups]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();

            // The API returns an object with _raw array of {key, value}
            const rawSettings: { key: string; value: string }[] = data._raw || [];
            const keysToFetch = ['linkedin_group_id', 'remotar_enabled', 'remotar_categories', 'remotar_filter_hours', 'vagasremotas_enabled', 'workei_enabled'];
            const results: Record<string, string> = {};

            rawSettings.forEach((s) => {
                if (keysToFetch.includes(s.key)) {
                    results[s.key] = s.value;
                }
            });

            setGroupId(results.linkedin_group_id || '');
            setRemotarEnabled(results.remotar_enabled === 'true');
            if (results.remotar_categories) {
                setRemotarCategories(results.remotar_categories);
            }
            if (results.remotar_filter_hours) {
                setRemotarHours(parseInt(results.remotar_filter_hours) || 48);
            }
            setVagasRemotasEnabled(results.vagasremotas_enabled === 'true');
            setWorkeiEnabled(results.workei_enabled === 'true');
        } catch (err) {
            console.error('Error fetching settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/jobs');
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
                setLatestJobs(data.latest);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save WhatsApp group_id
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'linkedin_group_id', value: groupId })
            });

            // Save Remotar settings
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'remotar_enabled', value: remotarEnabled ? 'true' : 'false' })
            });

            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'remotar_categories', value: remotarCategories })
            });

            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'remotar_filter_hours', value: String(remotarHours) })
            });

            // Save VagasRemotas settings
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'vagasremotas_enabled', value: vagasRemotasEnabled ? 'true' : 'false' })
            });

            // Save Workei settings
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'workei_enabled', value: workeiEnabled ? 'true' : 'false' })
            });

            alert('Configurações salvas com sucesso!');
        } catch (_err) {
            alert('Erro ao salvar configurações.');
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async () => {
        if (!confirm('Deseja iniciar a sincronização manual agora? Note que esse processo pode demorar alguns minutos.')) return;

        setSyncing(true);
        setSyncLogs(['Iniciando conexão de sincronização em tempo real...']);

        try {
            const eventSource = new EventSource('/api/jobs/sync/stream');

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'info' || data.type === 'progress') {
                        setSyncLogs(prev => [...prev, data.message]);
                    } else if (data.type === 'complete') {
                        eventSource.close();
                        setSyncing(false);
                        setSyncLogs(prev => [...prev, `[Sucesso] Sincronização concluída! Processados: ${data.stats.processed} | Postados: ${data.stats.posted} | Erros: ${data.stats.errors}`]);
                        fetchStats();
                    } else if (data.type === 'error') {
                        eventSource.close();
                        setSyncing(false);
                        setSyncLogs(prev => [...prev, `[ERRO] ${data.message}`]);
                    }
                } catch (e) {
                    console.error('Falha ao processar evento SSE', e);
                }
            };

            eventSource.onerror = (error) => {
                console.error("EventSource failed:", error);
                eventSource.close();
                setSyncing(false);
                setSyncLogs(prev => [...prev, '[ERRO FATAL] Conexão com o servidor perdida durante o streaming.']);
            };

        } catch (err) {
            alert('Erro ao iniciar a sincronização.');
            setSyncing(false);
        }
    };

    if (loading) return <div>Carregando...</div>;

    return (
        <div className={styles.section}>
            <div className={styles.sectionHeader}>
                <div className={styles.sectionInfo}>
                    <h2 className={styles.sectionTitle}>Automação de Vagas</h2>
                    <p className={styles.sectionDescription}>
                        Configure a extração automática de vagas remotas e postagem no WhatsApp.
                    </p>
                </div>
                <div className={styles.actions}>
                    <button
                        className={styles.syncButton}
                        onClick={handleSync}
                        disabled={syncing}
                    >
                        <RefreshCw size={16} className={syncing ? styles.spin : ''} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                    </button>
                    <button
                        className={styles.saveButton}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        <Save size={16} />
                        {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>

            {syncLogs.length > 0 && (
                <div style={{
                    backgroundColor: '#1e1e1e',
                    color: '#00ff00',
                    padding: '1rem',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    marginBottom: '1.5rem',
                    whiteSpace: 'pre-wrap',
                    border: '1px solid #333'
                }}>
                    {syncLogs.map((log, i) => (
                        <div key={i}>{log}</div>
                    ))}
                    {syncing && <div style={{ opacity: 0.7, marginTop: '0.5rem' }}>Aguardando... <Loader2 size={12} className={styles.spin} style={{ display: 'inline', verticalAlign: 'middle' }} /></div>}
                </div>
            )}

            <div className={styles.grid}>
                {/* WhatsApp Group Selector */}
                <div className={styles.card}>
                    <label className={styles.label}>Grupo do WhatsApp (vagas)</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                            className={styles.input}
                            value={groupId}
                            onChange={e => setGroupId(e.target.value)}
                            disabled={loadingGroups}
                            style={{ flex: 1 }}
                        >
                            <option value="">
                                {loadingGroups ? 'Carregando grupos...' : 'Selecione um grupo'}
                            </option>
                            {groups.map(group => (
                                <option key={group.id} value={group.id}>
                                    {group.subject} ({group.participants?.length ?? 0} participantes)
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={fetchGroups}
                            disabled={loadingGroups}
                            className={styles.syncButton}
                            style={{ padding: '0.75rem', minWidth: 'auto' }}
                            title="Recarregar grupos"
                        >
                            {loadingGroups
                                ? <Loader2 size={16} className={styles.spin} />
                                : <RefreshCw size={16} />
                            }
                        </button>
                    </div>
                    {groupsError && (
                        <p className={styles.helperText} style={{ color: '#dc2626' }}>
                            <AlertCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
                            {groupsError}
                        </p>
                    )}
                    {!groupsError && groups.length > 0 && (
                        <p className={styles.helperText}>
                            <Users size={12} style={{ display: 'inline', marginRight: 4 }} />
                            {groups.length} grupo(s) encontrado(s)
                        </p>
                    )}
                </div>

                {/* Remotar Toggle */}
                <div className={styles.card}>
                    <label className={styles.label}>
                        <Globe size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                        Remotar.com.br
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={() => setRemotarEnabled(!remotarEnabled)}
                            style={{
                                width: '48px',
                                height: '26px',
                                borderRadius: '13px',
                                border: 'none',
                                cursor: 'pointer',
                                position: 'relative',
                                transition: 'background 0.2s ease',
                                background: remotarEnabled ? '#16a34a' : '#d1d5db'
                            }}
                        >
                            <span style={{
                                position: 'absolute',
                                top: '3px',
                                left: remotarEnabled ? '24px' : '3px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: '#fff',
                                transition: 'left 0.2s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }} />
                        </button>
                        <span style={{ fontSize: '0.9rem', color: remotarEnabled ? '#16a34a' : '#6b7280' }}>
                            {remotarEnabled ? 'Ativado' : 'Desativado'}
                        </span>
                    </div>
                    <p className={styles.helperText}>
                        Busca vagas remotas automaticamente no Remotar.com.br. Não requer cookie ou login.
                    </p>
                    {remotarEnabled && (
                        <div style={{ marginTop: '0.75rem' }}>
                            <label className={styles.label} style={{ fontSize: '0.85rem' }}>Categorias (IDs separados por vírgula)</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={remotarCategories}
                                onChange={e => setRemotarCategories(e.target.value)}
                                placeholder="2,3,4,7,10,12,15,13,14,8"
                            />
                            <p className={styles.helperText}>
                                2 (Tech), 3 (Comercial), 4 (Conteúdo), 7 (Design), 8 (Marketing), 10 (Financeiro), 12 (Gestão), 13 (Dados), 14 (Produto), 15 (Suporte)
                            </p>
                            <div style={{ marginTop: '0.75rem' }}>
                                <label className={styles.label} style={{ fontSize: '0.85rem' }}>Período de busca (horas)</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={remotarHours}
                                    onChange={e => setRemotarHours(Math.max(1, parseInt(e.target.value) || 48))}
                                    min={1}
                                    max={720}
                                    style={{ width: '120px' }}
                                />
                                <p className={styles.helperText}>
                                    Busca apenas vagas publicadas nas últimas {remotarHours}h. Padrão: 48h.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* VagasRemotas Toggle */}
                <div className={styles.card}>
                    <label className={styles.label}>
                        <Briefcase size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                        VagasRemotas.com.br
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={() => setVagasRemotasEnabled(!vagasRemotasEnabled)}
                            style={{
                                width: '48px',
                                height: '26px',
                                borderRadius: '13px',
                                border: 'none',
                                cursor: 'pointer',
                                position: 'relative',
                                transition: 'background 0.2s ease',
                                background: vagasRemotasEnabled ? '#16a34a' : '#d1d5db'
                            }}
                        >
                            <span style={{
                                position: 'absolute',
                                top: '3px',
                                left: vagasRemotasEnabled ? '24px' : '3px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: '#fff',
                                transition: 'left 0.2s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }} />
                        </button>
                        <span style={{ fontSize: '0.9rem', color: vagasRemotasEnabled ? '#16a34a' : '#6b7280' }}>
                            {vagasRemotasEnabled ? 'Ativado' : 'Desativado'}
                        </span>
                    </div>
                    <p className={styles.helperText}>
                        Busca vagas 100% remotas no portal VagasRemotas.com.br. Compartilha o período de busca com o Remotar.
                    </p>
                </div>

                {/* Workei Toggle */}
                <div className={styles.card}>
                    <label className={styles.label}>
                        <Briefcase size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                        Workei.com.br
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={() => setWorkeiEnabled(!workeiEnabled)}
                            style={{
                                width: '48px',
                                height: '26px',
                                borderRadius: '13px',
                                border: 'none',
                                cursor: 'pointer',
                                position: 'relative',
                                transition: 'background 0.2s ease',
                                background: workeiEnabled ? '#16a34a' : '#d1d5db'
                            }}
                        >
                            <span style={{
                                position: 'absolute',
                                top: '3px',
                                left: workeiEnabled ? '24px' : '3px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: '#fff',
                                transition: 'left 0.2s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }} />
                        </button>
                        <span style={{ fontSize: '0.9rem', color: workeiEnabled ? '#16a34a' : '#6b7280' }}>
                            {workeiEnabled ? 'Ativado' : 'Desativado'}
                        </span>
                    </div>
                    <p className={styles.helperText}>
                        Busca vagas no portal de vagas Workei. Compartilha o período de busca com o Remotar.
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>Total Processado</span>
                    <span className={styles.statValue}>{stats.total}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>Vagas Postadas</span>
                    <span className={styles.statValue}>{stats.posted}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>Erros</span>
                    <span className={styles.statValue}>{stats.error}</span>
                </div>
            </div>

            {/* Latest Jobs */}
            <div className={styles.latestJobs}>
                <h3 className={styles.subTitle}>Últimas Vagas</h3>
                <div className={styles.jobList}>
                    {latestJobs.length === 0 ? (
                        <p className={styles.empty}>Nenhuma vaga processada ainda.</p>
                    ) : (
                        latestJobs.map((job: Record<string, unknown>) => (
                            <div key={job.id as string} className={styles.jobItem}>
                                <div className={styles.jobIcon}>
                                    <Briefcase size={18} />
                                </div>
                                <div className={styles.jobInfo}>
                                    <div className={styles.jobHeader}>
                                        <span className={styles.jobTitle}>{job.title as string}</span>
                                        <span className={`${styles.statusBadge} ${styles[job.status as string]}`}>
                                            {job.status === 'posted' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                            {job.status as string}
                                        </span>
                                    </div>
                                    <div className={styles.jobMeta}>
                                        <span>{job.company as string}</span> • <span>{job.location as string}</span>
                                    </div>
                                </div>
                                <a href={job.url as string} target="_blank" rel="noopener noreferrer" className={styles.jobLink}>
                                    <ExternalLink size={16} />
                                </a>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
