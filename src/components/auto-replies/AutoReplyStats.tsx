'use client';

/**
 * Auto-Reply Stats Component
 * Display usage statistics and analytics
 * Following system UI patterns
 */

import { useState, useEffect } from 'react';
import type { AutoReplyStats as StatsType } from '@/types/autoReply';
import { TrendingUp, MessageSquare, Calendar, BarChart3 } from 'lucide-react';
import styles from './AutoReplies.module.css';

export function AutoReplyStats() {
    const [stats, setStats] = useState<StatsType | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/auto-replies/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.tableContainer}>
                <div className={styles.loading}>Carregando estatísticas...</div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className={styles.tableContainer}>
                <div className={styles.empty}>Erro ao carregar estatísticas</div>
            </div>
        );
    }

    const StatCard = ({ icon: Icon, title, value, subtitle }: any) => (
        <div
            style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(0, 144, 231, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)'
                    }}
                >
                    <Icon size={20} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        {title}
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {value}
                    </div>
                    {subtitle && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            {subtitle}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <StatCard
                    icon={MessageSquare}
                    title="Hoje"
                    value={stats.total_sent_today}
                    subtitle="respostas enviadas"
                />
                <StatCard
                    icon={Calendar}
                    title="Esta Semana"
                    value={stats.total_sent_week}
                    subtitle="respostas enviadas"
                />
                <StatCard
                    icon={TrendingUp}
                    title="Este Mês"
                    value={stats.total_sent_month}
                    subtitle="respostas enviadas"
                />
            </div>

            {/* Average Confidence */}
            <div className={styles.tableContainer}>
                <div style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <BarChart3 size={20} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem', margin: 0 }}>
                            Confiança Média
                        </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ flex: 1, height: '8px', background: 'var(--bg-body)', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div
                                style={{
                                    height: '100%',
                                    width: `${stats.avg_confidence * 100}%`,
                                    background: 'var(--primary)',
                                    borderRadius: '9999px'
                                }}
                            />
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)', minWidth: '80px', textAlign: 'right' }}>
                            {(stats.avg_confidence * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>

            {/* By Intent */}
            <div className={styles.tableContainer}>
                <div style={{ padding: '1.5rem' }}>
                    <h3 style={{ color: 'var(--text-main)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
                        Respostas por Intenção
                    </h3>

                    {stats.by_intent.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            Nenhuma resposta enviada ainda
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {stats.by_intent.map((item, index) => {
                                const maxCount = Math.max(...stats.by_intent.map(i => i.count));
                                const percentage = (item.count / maxCount) * 100;

                                return (
                                    <div key={index}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500 }}>
                                                {item.name}
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                {item.count} {item.count === 1 ? 'vez' : 'vezes'}
                                            </span>
                                        </div>
                                        <div style={{ height: '6px', background: 'var(--bg-body)', borderRadius: '9999px', overflow: 'hidden' }}>
                                            <div
                                                style={{
                                                    height: '100%',
                                                    width: `${percentage}%`,
                                                    background: 'var(--primary)',
                                                    borderRadius: '9999px',
                                                    transition: 'width 0.3s ease'
                                                }}
                                            />
                                        </div>
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
