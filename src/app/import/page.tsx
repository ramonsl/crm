'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { Upload, AlertCircle, RefreshCw } from 'lucide-react';

export default function ImportPage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <ImportPageContent />
        </Suspense>
    );
}

function ImportPageContent() {
    const searchParams = useSearchParams();
    const [uploading, setUploading] = useState(false);
    const [stats, setStats] = useState<{ created: number; updated: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [importType, setImportType] = useState<'prime' | 'leads'>('prime');
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

            setStats({ created: data.created, updated: data.updated });
        } catch (err: any) {
            setError(err.message);
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
                    <div className={styles.stats}>
                        <div className={styles.statItem}>
                            <div className={styles.statValue}>{stats.created}</div>
                            <div className={styles.statLabel}>Novos Candidatos</div>
                        </div>
                        <div className={styles.statItem}>
                            <div className={styles.statValue}>{stats.updated}</div>
                            <div className={styles.statLabel}>Atualizados</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
