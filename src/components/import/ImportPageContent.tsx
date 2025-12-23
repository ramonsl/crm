'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { getErrorMessage } from '@/lib/types';
import styles from '@/app/import/page.module.css';

export function ImportPageContent() {
    const searchParams = useSearchParams();
    const [uploading, setUploading] = useState(false);
    const [stats, setStats] = useState<{
        created: number;
        updated: number;
        statusChanges: number;
        details?: {
            createdLeads: Array<{ nome: string; cpf: string; status: string }>;
            updatedLeads: Array<{ nome: string; cpf: string; oldStatus: string; newStatus: string }>;
            skippedDowngrades: Array<{ nome: string; cpf: string; currentStatus: string; attemptedStatus: string }>;
        }
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [importType, setImportType] = useState<'prime' | 'leads'>('prime');
    const [expandedSection, setExpandedSection] = useState<'created' | 'updated' | 'skipped' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const type = searchParams.get('type');
        if (type === 'leads' || type === 'prime') {
            setImportType(type);
        }
    }, [searchParams]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError(null);
        setStats(null);
        setExpandedSection(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', importType);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            setStats({
                created: data.created,
                updated: data.updated,
                statusChanges: data.statusChanges,
                details: data.details
            });
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Importar Dados</h1>
                <p className={styles.subtitle}>Carregue sua planilha de candidatos</p>
            </header>

            <div className={styles.card}>
                <div
                    className={styles.uploadSection}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className={styles.typeSelection}>
                        <label className={styles.radioLabel}>
                            <input
                                type="radio"
                                name="importType"
                                value="prime"
                                checked={importType === 'prime'}
                                onChange={(e) => setImportType(e.target.value as 'prime' | 'leads')}
                            />
                            Sistema Prime
                        </label>
                        <label className={styles.radioLabel}>
                            <input
                                type="radio"
                                name="importType"
                                value="leads"
                                checked={importType === 'leads'}
                                onChange={(e) => setImportType(e.target.value as 'prime' | 'leads')}
                            />
                            Novos Leads (Planilha Simples)
                        </label>
                    </div>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".xlsx,.xls,.csv"
                        hidden
                    />
                    {uploading ? (
                        <RefreshCw className={`${styles.uploadIcon} ${styles.spin}`} />
                    ) : (
                        <Upload className={styles.uploadIcon} />
                    )}
                    <div className={styles.textCenter}>
                        <p className={styles.uploadText}>
                            {uploading ? 'Processando...' : 'Clique para importar planilha'}
                        </p>
                        <p className={styles.uploadSubtext}>
                            Suporta .xlsx, .xls, .csv
                        </p>
                    </div>
                </div>

                {error && (
                    <div className={styles.errorBox}>
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                {stats && (
                    <div className={styles.results}>
                        <div className={styles.stats}>
                            <div className={styles.statItem}>
                                <div className={styles.statValue}>{stats.created}</div>
                                <div className={styles.statLabel}>Novos Candidatos</div>
                            </div>
                            <div className={styles.statItem}>
                                <div className={styles.statValue}>{stats.statusChanges}</div>
                                <div className={styles.statLabel}>Mudanças de Status</div>
                            </div>
                            <div className={styles.statItem}>
                                <div className={styles.statValue}>{stats.updated}</div>
                                <div className={styles.statLabel}>Total Atualizados</div>
                            </div>
                        </div>

                        {stats.details && (
                            <div className={styles.details}>
                                {/* New Leads */}
                                {stats.details.createdLeads.length > 0 && (
                                    <div className={styles.detailSection}>
                                        <button
                                            className={styles.detailHeader}
                                            onClick={() => setExpandedSection(expandedSection === 'created' ? null : 'created')}
                                        >
                                            <CheckCircle2 size={18} color="#10b981" />
                                            <span>{stats.details.createdLeads.length} Novo{stats.details.createdLeads.length > 1 ? 's' : ''} Cadastrado{stats.details.createdLeads.length > 1 ? 's' : ''}</span>
                                            <span className={styles.toggleIcon}>{expandedSection === 'created' ? '−' : '+'}</span>
                                        </button>
                                        {expandedSection === 'created' && (
                                            <div className={styles.detailContent}>
                                                {stats.details.createdLeads.map((lead, i) => (
                                                    <div key={i} className={styles.detailItem}>
                                                        <div className={styles.leadName}>{lead.nome}</div>
                                                        <div className={styles.leadInfo}>
                                                            <span>CPF: {lead.cpf}</span>
                                                            <span className={styles.badge}>{lead.status}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Updated Leads */}
                                {stats.details.updatedLeads.length > 0 && (
                                    <div className={styles.detailSection}>
                                        <button
                                            className={styles.detailHeader}
                                            onClick={() => setExpandedSection(expandedSection === 'updated' ? null : 'updated')}
                                        >
                                            <RefreshCw size={18} color="#3b82f6" />
                                            <span>{stats.details.updatedLeads.length} Mudança{stats.details.updatedLeads.length > 1 ? 's' : ''} de Status</span>
                                            <span className={styles.toggleIcon}>{expandedSection === 'updated' ? '−' : '+'}</span>
                                        </button>
                                        {expandedSection === 'updated' && (
                                            <div className={styles.detailContent}>
                                                {stats.details.updatedLeads.map((lead, i) => (
                                                    <div key={i} className={styles.detailItem}>
                                                        <div className={styles.leadName}>{lead.nome}</div>
                                                        <div className={styles.leadInfo}>
                                                            <span>CPF: {lead.cpf}</span>
                                                            <div className={styles.statusChange}>
                                                                <span className={styles.badge}>{lead.oldStatus}</span>
                                                                <span>→</span>
                                                                <span className={styles.badge} style={{ background: '#10b981' }}>{lead.newStatus}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Skipped Downgrades */}
                                {stats.details.skippedDowngrades.length > 0 && (
                                    <div className={styles.detailSection}>
                                        <button
                                            className={styles.detailHeader}
                                            onClick={() => setExpandedSection(expandedSection === 'skipped' ? null : 'skipped')}
                                        >
                                            <AlertCircle size={18} color="#f59e0b" />
                                            <span>{stats.details.skippedDowngrades.length} Downgrade{stats.details.skippedDowngrades.length > 1 ? 's' : ''} Ignorado{stats.details.skippedDowngrades.length > 1 ? 's' : ''}</span>
                                            <span className={styles.toggleIcon}>{expandedSection === 'skipped' ? '−' : '+'}</span>
                                        </button>
                                        {expandedSection === 'skipped' && (
                                            <div className={styles.detailContent}>
                                                {stats.details.skippedDowngrades.map((lead, i) => (
                                                    <div key={i} className={styles.detailItem}>
                                                        <div className={styles.leadName}>{lead.nome}</div>
                                                        <div className={styles.leadInfo}>
                                                            <span>CPF: {lead.cpf}</span>
                                                            <div className={styles.statusChange}>
                                                                <span className={styles.badge}>{lead.currentStatus}</span>
                                                                <span>✗</span>
                                                                <span className={styles.badgeFaded}>{lead.attemptedStatus}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
