/**
 * Jobs Dashboard Page
 * 
 * Dashboard for tracking posted jobs with metrics by source, tags, and time period.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Briefcase,
    RefreshCw,
    TrendingUp,
    Calendar,
    AlertTriangle,
    ExternalLink,
    Globe,
    BarChart3
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import styles from './vagas.module.css';

interface JobStats {
    total: number;
    posted: number;
    errors: number;
    today: number;
    last7Days: number;
    bySource: { source: string; count: number }[];
    byTag: { tag: string; count: number }[];
}

interface JobEntry {
    id: number;
    linkedin_post_id: string;
    title: string;
    company: string;
    location: string;
    is_remote: boolean;
    url: string;
    status: string;
    formatted_message: string;
    created_at: string;
    posted_at: string;
}

interface Pagination {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}

const TAG_STYLES: Record<string, { class: string; emoji: string; color: string }> = {
    'Estágio': { class: 'tagEstagio', emoji: '🐣', color: '#f59e0b' },
    'Júnior': { class: 'tagJunior', emoji: '🟢', color: '#10b981' },
    'PcD': { class: 'tagPcd', emoji: '♿', color: '#8b5cf6' },
    'Internacional': { class: 'tagInternacional', emoji: '✈️', color: '#3b82f6' },
    'Para Mulheres': { class: 'tagMulheres', emoji: '👩🏻', color: '#ec4899' },
    'LGBTQIAP+': { class: 'tagLgbt', emoji: '🌈', color: '#a855f7' },
    'Jovem Aprendiz': { class: 'tagAprendiz', emoji: '👨🏼‍🎓', color: '#f59e0b' },
    'Freelancer': { class: 'tagFreelancer', emoji: '💻', color: '#6366f1' },
    'Banco de Talentos': { class: 'tagBancoTalentos', emoji: '🌟', color: '#22c55e' },
    'Diversidade': { class: 'tagDiversidade', emoji: '🤝', color: '#f97316' },
};

const SOURCE_CONFIG: Record<string, { color: string; icon: string }> = {
    'Remotar': { color: '#10b981', icon: '🌐' },
    'VagasRemotas': { color: '#eab308', icon: '🇧🇷' },
    'LinkedIn': { color: '#0077b5', icon: '💼' },
};

export default function VagasPage() {
    const { success: toastSuccess, error: toastError } = useToast();
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [stats, setStats] = useState<JobStats | null>(null);
    const [jobs, setJobs] = useState<JobEntry[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ total: 0, limit: 20, offset: 0, hasMore: false });

    const loadData = useCallback(async (offset = 0) => {
        try {
            const res = await fetch(`/api/jobs?limit=20&offset=${offset}`);
            const data = await res.json();

            if (data.success) {
                setStats(data.stats);
                setJobs(data.latest || []);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('Error loading jobs:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();

            if (data.success) {
                toastSuccess(`Sincronização concluída! ${data.stats?.remotar?.posted || 0} vagas novas postadas.`);
                await loadData();
            } else {
                toastError(data.error || 'Erro na sincronização');
            }
        } catch {
            toastError('Erro na sincronização');
        } finally {
            setSyncing(false);
        }
    };

    const handlePageChange = (newOffset: number) => {
        setLoading(true);
        loadData(newOffset);
    };

    const getSourceFromPostId = (postId: string): string => {
        if (postId.startsWith('remotar-')) return 'Remotar';
        if (postId.startsWith('vagasremotas-')) return 'VagasRemotas';
        return 'LinkedIn';
    };

    const getJobTags = (message: string): string[] => {
        const tags: string[] = [];
        if (message.includes('ESTÁGIO')) tags.push('Estágio');
        if (message.includes('JÚNIOR') || message.includes('JUNIOR')) tags.push('Júnior');
        if (message.includes('PcD')) tags.push('PcD');
        if (message.includes('INTERNACIONAL')) tags.push('Internacional');
        if (message.includes('PARA MULHERES')) tags.push('Para Mulheres');
        if (message.includes('LGBTQIAP')) tags.push('LGBTQIAP+');
        if (message.includes('JOVEM APRENDIZ')) tags.push('Jovem Aprendiz');
        if (message.includes('FREELANCER')) tags.push('Freelancer');
        if (message.includes('BANCO DE TALENTOS')) tags.push('Banco de Talentos');
        if (message.includes('DIVERSIDADE')) tags.push('Diversidade');
        return tags;
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    <p>Carregando vagas...</p>
                </div>
            </div>
        );
    }

    const maxTagCount = Math.max(...(stats?.byTag.map(t => t.count) || [1]), 1);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1><Briefcase size={28} /> Vagas Enviadas</h1>
                    <p className={styles.subtitle}>Acompanhe as vagas postadas no grupo WhatsApp</p>
                </div>
                <div className={styles.headerActions}>
                    <button
                        className={`${styles.syncButton} ${syncing ? styles.syncing : ''}`}
                        onClick={handleSync}
                        disabled={syncing}
                    >
                        <RefreshCw size={18} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                        <Briefcase size={24} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.cardLabel}>Total Enviadas</span>
                        <span className={styles.cardValue}>{stats?.posted || 0}</span>
                    </div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        <Calendar size={24} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.cardLabel}>Hoje</span>
                        <span className={styles.cardValue}>{stats?.today || 0}</span>
                    </div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.cardLabel}>Últimos 7 dias</span>
                        <span className={styles.cardValue}>{stats?.last7Days || 0}</span>
                    </div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                        <AlertTriangle size={24} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.cardLabel}>Erros</span>
                        <span className={styles.cardValue}>{stats?.errors || 0}</span>
                    </div>
                </div>
            </div>

            {/* Charts Grid: Sources + Tags */}
            <div className={styles.chartsGrid}>
                {/* By Source */}
                <div className={styles.chartSection}>
                    <h2><Globe size={18} /> Por Fonte</h2>
                    <div className={styles.sourceGrid}>
                        {(stats?.bySource || []).map(s => {
                            const config = SOURCE_CONFIG[s.source] || { color: '#6b7280', icon: '📋' };
                            return (
                                <div key={s.source} className={styles.sourceCard}>
                                    <div className={styles.sourceIcon} style={{ background: config.color }}>
                                        <span style={{ fontSize: '1.2rem' }}>{config.icon}</span>
                                    </div>
                                    <span className={styles.sourceValue}>{s.count}</span>
                                    <span className={styles.sourceName}>{s.source}</span>
                                </div>
                            );
                        })}
                        {(!stats?.bySource || stats.bySource.length === 0) && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma vaga enviada ainda</p>
                        )}
                    </div>
                </div>

                {/* By Tag */}
                <div className={styles.chartSection}>
                    <h2><BarChart3 size={18} /> Por Tipo / Nível</h2>
                    <div className={styles.barChartHorizontal}>
                        {(stats?.byTag || []).map(t => {
                            const tagStyle = TAG_STYLES[t.tag];
                            const widthPercent = (t.count / maxTagCount) * 100;
                            return (
                                <div key={t.tag} className={styles.barRow}>
                                    <span className={styles.barLabel}>
                                        {tagStyle?.emoji} {t.tag}
                                    </span>
                                    <div className={styles.barTrack}>
                                        <div
                                            className={styles.barFill}
                                            style={{
                                                width: `${Math.max(widthPercent, 5)}%`,
                                                background: tagStyle?.color || '#6b7280'
                                            }}
                                        >
                                            {widthPercent > 20 && (
                                                <span className={styles.barCount}>{t.count}</span>
                                            )}
                                        </div>
                                    </div>
                                    {widthPercent <= 20 && (
                                        <span className={styles.barCountOutside}>{t.count}</span>
                                    )}
                                </div>
                            );
                        })}
                        {(!stats?.byTag || stats.byTag.length === 0) && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma tag encontrada</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Jobs Table */}
            <div className={styles.tableSection}>
                <div className={styles.tableHeader}>
                    <h2><Briefcase size={18} /> Últimas Vagas</h2>
                </div>
                {jobs.length > 0 ? (
                    <>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Vaga</th>
                                    <th>Tags</th>
                                    <th>Fonte</th>
                                    <th>Data</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map(job => {
                                    const source = getSourceFromPostId(job.linkedin_post_id);
                                    const tags = getJobTags(job.formatted_message || '');
                                    return (
                                        <tr key={job.id}>
                                            <td>
                                                <div className={styles.jobTitle}>{job.title}</div>
                                                <div className={styles.jobCompany}>{job.company}</div>
                                            </td>
                                            <td>
                                                {tags.map(tag => {
                                                    const ts = TAG_STYLES[tag];
                                                    return (
                                                        <span
                                                            key={tag}
                                                            className={`${styles.tagBadge} ${ts ? styles[ts.class] : ''}`}
                                                        >
                                                            {ts?.emoji} {tag}
                                                        </span>
                                                    );
                                                })}
                                                {tags.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                                            </td>
                                            <td>
                                                <span className={`${styles.sourceTag} ${source === 'Remotar' ? styles.sourceRemotar :
                                                        source === 'VagasRemotas' ? styles.sourceVagasRemotas :
                                                            styles.sourceLinkedin
                                                    }`}>
                                                    {source}
                                                </span>
                                            </td>
                                            <td className={styles.dateCell}>
                                                {formatDate(job.created_at)}
                                            </td>
                                            <td>
                                                <span className={`${styles.sourceTag} ${job.status === 'posted' ? styles.statusPosted :
                                                    job.status === 'error' ? styles.statusError :
                                                        styles.statusPending
                                                    }`}>
                                                    {job.status === 'posted' ? 'Enviada' :
                                                        job.status === 'error' ? 'Erro' : job.status}
                                                </span>
                                            </td>
                                            <td>
                                                {job.url && (
                                                    <a
                                                        href={job.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={styles.jobLink}
                                                        title="Abrir vaga"
                                                    >
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        <div className={styles.pagination}>
                            <button
                                onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                                disabled={pagination.offset === 0}
                            >
                                ← Anterior
                            </button>
                            <span className={styles.paginationInfo}>
                                {pagination.offset + 1}–{Math.min(pagination.offset + pagination.limit, pagination.total)} de {pagination.total}
                            </span>
                            <button
                                onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                                disabled={!pagination.hasMore}
                            >
                                Próxima →
                            </button>
                        </div>
                    </>
                ) : (
                    <div className={styles.emptyState}>
                        <Briefcase size={48} />
                        <p>Nenhuma vaga enviada ainda</p>
                        <p style={{ fontSize: '0.8rem' }}>Configure o Remotar nas Configurações e clique em &quot;Sincronizar Agora&quot;</p>
                    </div>
                )}
            </div>
        </div>
    );
}
