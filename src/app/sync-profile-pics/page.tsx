'use client';

import { useState } from 'react';
import styles from '../whatsapp/page.module.css';
import { RefreshCw } from 'lucide-react';

export default function SyncProfilePicsPage() {
    const [syncing, setSyncing] = useState(false);
    const [results, setResults] = useState<any>(null);

    const handleSync = async () => {
        setSyncing(true);
        setResults(null);

        try {
            const res = await fetch('/api/whatsapp/sync-profile-pics', {
                method: 'POST'
            });

            const data = await res.json();
            setResults(data);
        } catch (error) {
            console.error('Error syncing profile pictures:', error);
            setResults({ error: 'Failed to sync profile pictures' });
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Sincronizar Fotos de Perfil</h1>
                    <p className={styles.subtitle}>Buscar fotos de perfil do WhatsApp para todos os contatos</p>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Sincronização Manual</h3>
                </div>
                <div className={styles.cardBody}>
                    <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                        Esta ação buscará as fotos de perfil do WhatsApp para todos os contatos cadastrados
                        e atualizará o banco de dados. Contatos sem foto de perfil ou com configurações de
                        privacidade ativadas não terão suas fotos atualizadas.
                    </p>

                    <button
                        className={styles.primaryButton}
                        onClick={handleSync}
                        disabled={syncing}
                    >
                        {syncing ? (
                            <>
                                <RefreshCw size={20} className={styles.spin} />
                                Sincronizando...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={20} />
                                Iniciar Sincronização
                            </>
                        )}
                    </button>

                    {results && (
                        <div style={{ marginTop: '2rem' }}>
                            {results.error ? (
                                <div style={{
                                    padding: '1rem',
                                    backgroundColor: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    borderRadius: '8px',
                                    color: '#dc2626'
                                }}>
                                    <strong>Erro:</strong> {results.error || results.message}
                                </div>
                            ) : (
                                <div style={{
                                    padding: '1rem',
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '8px'
                                }}>
                                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#16a34a' }}>
                                        ✓ Sincronização Concluída
                                    </h4>
                                    <p style={{ margin: '0.5rem 0', color: '#4b5563' }}>
                                        <strong>Total de contatos:</strong> {results.total}
                                    </p>
                                    <p style={{ margin: '0.5rem 0', color: '#16a34a' }}>
                                        <strong>Fotos atualizadas:</strong> {results.successCount}
                                    </p>
                                    <p style={{ margin: '0.5rem 0', color: '#d97706' }}>
                                        <strong>Sem foto/privacidade:</strong> {results.failCount}
                                    </p>

                                    {results.results && results.results.length > 0 && (
                                        <details style={{ marginTop: '1rem' }}>
                                            <summary style={{ cursor: 'pointer', color: '#3b82f6', fontWeight: 500 }}>
                                                Ver detalhes
                                            </summary>
                                            <div style={{
                                                maxHeight: '300px',
                                                overflowY: 'auto',
                                                marginTop: '0.5rem',
                                                fontSize: '0.875rem'
                                            }}>
                                                {results.results.map((result: any, idx: number) => (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            padding: '0.5rem',
                                                            borderBottom: '1px solid #e5e7eb',
                                                            display: 'flex',
                                                            justifyContent: 'space-between'
                                                        }}
                                                    >
                                                        <span>{result.nome}</span>
                                                        <span style={{
                                                            color: result.status === 'success' ? '#16a34a' : '#d97706',
                                                            fontSize: '0.75rem'
                                                        }}>
                                                            {result.status === 'success' ? '✓ Atualizado' : '⚠️ Sem foto'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
