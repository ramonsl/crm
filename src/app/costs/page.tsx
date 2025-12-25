/**
 * Costs Dashboard Page
 * 
 * Track and visualize costs for OpenAI, Railway, and YCloud services.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    DollarSign,
    TrendingUp,
    Calendar,
    Plus,
    Trash2,
    ExternalLink,
    Brain,
    Server,
    Cloud,
    X,
    Phone,
    RefreshCw
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import styles from './costs.module.css';

interface CostEntry {
    id: number;
    service: 'openai' | 'railway' | 'ycloud' | 'phone';
    amount: number;
    currency: string;
    periodMonth: number;
    periodYear: number;
    source: string;
    description?: string;
}

interface CostsSummary {
    currentMonth: {
        openai: number;
        railway: number;
        ycloud: number;
        phone: number;
        total: number;
    };
    currentYear: {
        openai: number;
        railway: number;
        ycloud: number;
        phone: number;
        total: number;
    };
    monthlyHistory: Array<{
        service: string;
        month: number;
        year: number;
        amount: number;
    }>;
}

const SERVICE_CONFIG = {
    openai: {
        name: 'OpenAI',
        icon: Brain,
        color: '#10a37f',
        dashboardUrl: 'https://platform.openai.com/usage'
    },
    railway: {
        name: 'Railway',
        icon: Server,
        color: '#844fba',
        dashboardUrl: 'https://railway.app/account/billing'
    },
    ycloud: {
        name: 'YCloud',
        icon: Cloud,
        color: '#0ea5e9',
        dashboardUrl: 'https://ycloud.com/dashboard'
    },
    phone: {
        name: 'Telefone',
        icon: Phone,
        color: '#f59e0b',
        dashboardUrl: ''
    }
};

const MONTHS = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export default function CostsPage() {
    const { success: toastSuccess, error: toastError } = useToast();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<CostsSummary | null>(null);
    const [entries, setEntries] = useState<CostEntry[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formService, setFormService] = useState<'openai' | 'railway' | 'ycloud' | 'phone'>('openai');
    const [formAmount, setFormAmount] = useState('');
    const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1);
    const [formYear, setFormYear] = useState(new Date().getFullYear());
    const [formDescription, setFormDescription] = useState('');
    const [syncing, setSyncing] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const res = await fetch('/api/costs');
            const data = await res.json();
            setSummary(data.summary);
            setEntries(data.entries || []);
        } catch (error) {
            console.error('Error loading costs:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formAmount || parseFloat(formAmount) <= 0) {
            toastError('Informe um valor válido');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: formService,
                    amount: parseFloat(formAmount),
                    periodMonth: formMonth,
                    periodYear: formYear,
                    description: formDescription
                })
            });

            if (res.ok) {
                toastSuccess('Custo registrado!');
                setShowModal(false);
                setFormAmount('');
                setFormDescription('');
                loadData();
            } else {
                toastError('Erro ao salvar');
            }
        } catch {
            toastError('Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Remover este registro?')) return;

        try {
            const res = await fetch(`/api/costs?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toastSuccess('Registro removido');
                loadData();
            } else {
                toastError('Erro ao remover');
            }
        } catch {
            toastError('Erro ao remover');
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    };

    // Calculate max value for chart scaling
    const getChartData = () => {
        const months: { [key: string]: { openai: number; railway: number; ycloud: number; phone: number } } = {};

        // Initialize last 6 months
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
            months[key] = { openai: 0, railway: 0, ycloud: 0, phone: 0 };
        }

        // Fill with data
        summary?.monthlyHistory.forEach(entry => {
            const key = `${entry.year}-${entry.month}`;
            if (months[key]) {
                months[key][entry.service as keyof typeof months[typeof key]] = entry.amount;
            }
        });

        return Object.entries(months).map(([key, values]) => {
            const [year, month] = key.split('-');
            return {
                label: `${MONTHS[parseInt(month) - 1]}/${year.slice(2)}`,
                ...values,
                total: values.openai + values.railway + values.ycloud + values.phone
            };
        });
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    <p>Carregando custos...</p>
                </div>
            </div>
        );
    }

    const chartData = getChartData();
    const maxChartValue = Math.max(...chartData.map(d => d.total), 1);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1><DollarSign size={28} /> Custos</h1>
                    <p className={styles.subtitle}>Acompanhe seus gastos com serviços cloud</p>
                </div>
                <button
                    className={styles.addButton}
                    onClick={() => setShowModal(true)}
                >
                    <Plus size={20} />
                    Adicionar Custo
                </button>
            </div>

            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        <Calendar size={24} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.cardLabel}>Este Mês</span>
                        <span className={styles.cardValue}>{formatCurrency(summary?.currentMonth.total || 0)}</span>
                    </div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.cardLabel}>Este Ano</span>
                        <span className={styles.cardValue}>{formatCurrency(summary?.currentYear.total || 0)}</span>
                    </div>
                </div>

                {/* Service-specific cards */}
                {Object.entries(SERVICE_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    const monthValue = summary?.currentMonth[key as keyof typeof summary.currentMonth] || 0;

                    return (
                        <div key={key} className={styles.serviceCard}>
                            <div className={styles.serviceHeader}>
                                <Icon size={20} style={{ color: config.color }} />
                                <span>{config.name}</span>
                                <a
                                    href={config.dashboardUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.externalLink}
                                    title="Ir para dashboard"
                                >
                                    <ExternalLink size={14} />
                                </a>
                            </div>
                            <div className={styles.serviceValue} style={{ color: config.color }}>
                                {formatCurrency(monthValue)}
                            </div>
                            <div className={styles.serviceLabel}>este mês</div>
                        </div>
                    );
                })}
            </div>

            {/* Chart */}
            <div className={styles.chartSection}>
                <h2>Evolução Mensal</h2>
                <div className={styles.chart}>
                    {chartData.map((data, i) => (
                        <div key={i} className={styles.chartBar}>
                            <div className={styles.barStack}>
                                {data.openai > 0 && (
                                    <div
                                        className={styles.barSegment}
                                        style={{
                                            height: `${(data.openai / maxChartValue) * 150}px`,
                                            background: SERVICE_CONFIG.openai.color
                                        }}
                                        title={`OpenAI: ${formatCurrency(data.openai)}`}
                                    />
                                )}
                                {data.railway > 0 && (
                                    <div
                                        className={styles.barSegment}
                                        style={{
                                            height: `${(data.railway / maxChartValue) * 150}px`,
                                            background: SERVICE_CONFIG.railway.color
                                        }}
                                        title={`Railway: ${formatCurrency(data.railway)}`}
                                    />
                                )}
                                {data.ycloud > 0 && (
                                    <div
                                        className={styles.barSegment}
                                        style={{
                                            height: `${(data.ycloud / maxChartValue) * 150}px`,
                                            background: SERVICE_CONFIG.ycloud.color
                                        }}
                                        title={`YCloud: ${formatCurrency(data.ycloud)}`}
                                    />
                                )}
                                {data.phone > 0 && (
                                    <div
                                        className={styles.barSegment}
                                        style={{
                                            height: `${(data.phone / maxChartValue) * 150}px`,
                                            background: SERVICE_CONFIG.phone.color
                                        }}
                                        title={`Telefone: ${formatCurrency(data.phone)}`}
                                    />
                                )}
                            </div>
                            <span className={styles.barLabel}>{data.label}</span>
                        </div>
                    ))}
                </div>
                <div className={styles.chartLegend}>
                    {Object.entries(SERVICE_CONFIG).map(([key, config]) => (
                        <div key={key} className={styles.legendItem}>
                            <span className={styles.legendDot} style={{ background: config.color }} />
                            {config.name}
                        </div>
                    ))}
                </div>
            </div>

            {/* Entries Table */}
            <div className={styles.tableSection}>
                <h2>Histórico de Lançamentos</h2>
                {entries.length > 0 ? (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Serviço</th>
                                <th>Período</th>
                                <th>Valor</th>
                                <th>Descrição</th>
                                <th>Fonte</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(entry => {
                                const config = SERVICE_CONFIG[entry.service];
                                const Icon = config?.icon || Cloud;

                                return (
                                    <tr key={entry.id}>
                                        <td>
                                            <div className={styles.serviceCell}>
                                                <Icon size={16} style={{ color: config?.color }} />
                                                {config?.name || entry.service}
                                            </div>
                                        </td>
                                        <td>{MONTHS[entry.periodMonth - 1]}/{entry.periodYear}</td>
                                        <td className={styles.amountCell}>{formatCurrency(entry.amount)}</td>
                                        <td>{entry.description || '-'}</td>
                                        <td>
                                            <span className={`${styles.sourceTag} ${styles[entry.source]}`}>
                                                {entry.source === 'api' ? 'API' : 'Manual'}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => handleDelete(entry.id)}
                                                title="Remover"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className={styles.emptyState}>
                        <DollarSign size={48} />
                        <p>Nenhum lançamento registrado</p>
                        <button onClick={() => setShowModal(true)}>
                            <Plus size={16} /> Adicionar primeiro custo
                        </button>
                    </div>
                )}
            </div>

            {/* Add Cost Modal */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Adicionar Custo</h3>
                            <button onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label>Serviço</label>
                                <div className={styles.serviceSelector}>
                                    {Object.entries(SERVICE_CONFIG).map(([key, config]) => {
                                        const Icon = config.icon;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                className={`${styles.serviceOption} ${formService === key ? styles.selected : ''}`}
                                                onClick={() => setFormService(key as typeof formService)}
                                                style={formService === key ? { borderColor: config.color, color: config.color } : {}}
                                            >
                                                <Icon size={20} />
                                                {config.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Mês</label>
                                    <select
                                        value={formMonth}
                                        onChange={e => setFormMonth(parseInt(e.target.value))}
                                    >
                                        {MONTHS.map((m, i) => (
                                            <option key={i} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Ano</label>
                                    <select
                                        value={formYear}
                                        onChange={e => setFormYear(parseInt(e.target.value))}
                                    >
                                        {[2024, 2025, 2026].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Valor (USD)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formAmount}
                                    onChange={e => setFormAmount(e.target.value)}
                                    placeholder="0.00"
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Descrição (opcional)</label>
                                <input
                                    type="text"
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    placeholder="Ex: Uso de GPT-4"
                                />
                            </div>

                            <div className={styles.formActions}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className={styles.cancelBtn}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className={styles.submitBtn}
                                    disabled={saving}
                                >
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
