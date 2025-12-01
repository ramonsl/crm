'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { Trash2, AlertTriangle, RefreshCw, Image, MessageSquare } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

export default function SettingsPage() {
    const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
    const [deleting, setDeleting] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [savingKey, setSavingKey] = useState(false);

    const [minDelay, setMinDelay] = useState(30);
    const [maxDelay, setMaxDelay] = useState(60);
    const [savingDelays, setSavingDelays] = useState(false);

    const [metaMatriculas, setMetaMatriculas] = useState(0);
    const [savingMeta, setSavingMeta] = useState(false);

    // WhatsApp sync states
    const [syncingPics, setSyncingPics] = useState(false);
    const [picsResults, setPicsResults] = useState<any>(null);
    const [syncingHistory, setSyncingHistory] = useState(false);
    const [historyResults, setHistoryResults] = useState<any>(null);

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.openaiApiKey) setApiKey(data.openaiApiKey);
                if (data.minDelay) setMinDelay(Number(data.minDelay));
                if (data.maxDelay) setMaxDelay(Number(data.maxDelay));
                if (data.metaMatriculas) setMetaMatriculas(Number(data.metaMatriculas));
            });
    }, []);

    const handleSaveKey = async () => {
        setSavingKey(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ openaiApiKey: apiKey })
            });
            if (res.ok) {
                toastSuccess('Chave API salva com sucesso!');
            } else {
                toastError('Erro ao salvar chave.');
            }
        } catch (error) {
            console.error(error);
            toastError('Erro ao salvar.');
        } finally {
            setSavingKey(false);
        }
    };

    const handleSaveDelays = async () => {
        if (minDelay < 1 || maxDelay < minDelay) {
            toastWarning('Valores inválidos. O mínimo deve ser >= 1 e o máximo >= mínimo.');
            return;
        }

        setSavingDelays(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ minDelay, maxDelay })
            });
            if (res.ok) {
                toastSuccess('Configurações de delay salvas!');
            } else {
                toastError('Erro ao salvar configurações.');
            }
        } catch (error) {
            console.error(error);
            toastError('Erro ao salvar.');
        } finally {
            setSavingDelays(false);
        }
    };

    const handleSaveMeta = async () => {
        setSavingMeta(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metaMatriculas })
            });
            if (res.ok) {
                toastSuccess('Meta salva com sucesso!');
            } else {
                toastError('Erro ao salvar meta.');
            }
        } catch (error) {
            console.error(error);
            toastError('Erro ao salvar.');
        } finally {
            setSavingMeta(false);
        }
    };

    const handleSyncProfilePics = async () => {
        setSyncingPics(true);
        setPicsResults(null);

        try {
            const res = await fetch('/api/whatsapp/sync-profile-pics', {
                method: 'POST'
            });

            const data = await res.json();
            setPicsResults(data);
        } catch (error) {
            console.error('Error syncing profile pictures:', error);
            setPicsResults({ error: 'Falha ao sincronizar fotos de perfil' });
        } finally {
            setSyncingPics(false);
        }
    };

    const handleSyncHistory = async () => {
        setSyncingHistory(true);
        setHistoryResults(null);

        try {
            const res = await fetch('/api/whatsapp/sync-history', {
                method: 'POST'
            });

            const data = await res.json();
            setHistoryResults(data);
        } catch (error) {
            console.error('Error syncing history:', error);
            setHistoryResults({ error: 'Falha ao sincronizar histórico' });
        } finally {
            setSyncingHistory(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm('TEM CERTEZA? Isso apagará TODOS os contatos permanentemente. Esta ação não pode ser desfeita.')) {
            return;
        }

        // Double check
        const confirmation = prompt('Digite "DELETAR" para confirmar:');
        if (confirmation !== 'DELETAR') {
            toastWarning('Ação cancelada.');
            return;
        }

        setDeleting(true);
        try {
            const res = await fetch('/api/leads?all=true', {
                method: 'DELETE'
            });

            if (res.ok) {
                toastSuccess('Todos os contatos foram apagados.');
            } else {
                toastError('Erro ao apagar contatos.');
            }
        } catch (error) {
            console.error(error);
            toastError('Erro ao processar solicitação.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Configurações</h1>
                <p className={styles.subtitle}>Gerencie as preferências do sistema</p>
            </header>

            <div className={styles.grid}>
                {/* System Preferences Group */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Preferências do Sistema</h2>
                    <p className={styles.description}>
                        Configurações gerais de comportamento do sistema.
                    </p>

                    <div style={{ marginBottom: '2rem' }}>
                        <label className={styles.label}>Meta de Matrículas</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="number"
                                value={metaMatriculas}
                                onChange={(e) => setMetaMatriculas(Number(e.target.value))}
                                className={styles.input}
                            />
                            <button
                                onClick={handleSaveMeta}
                                disabled={savingMeta}
                                className={styles.button}
                            >
                                {savingMeta ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className={styles.label}>Intervalo de Envio (segundos)</label>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <label className={styles.label} style={{ fontSize: '0.75rem' }}>Mínimo</label>
                                <input
                                    type="number"
                                    value={minDelay}
                                    onChange={(e) => setMinDelay(Number(e.target.value))}
                                    className={styles.input}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className={styles.label} style={{ fontSize: '0.75rem' }}>Máximo</label>
                                <input
                                    type="number"
                                    value={maxDelay}
                                    onChange={(e) => setMaxDelay(Number(e.target.value))}
                                    className={styles.input}
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleSaveDelays}
                            disabled={savingDelays}
                            className={styles.button}
                            style={{ width: '100%' }}
                        >
                            {savingDelays ? 'Salvar Intervalos' : 'Salvar Intervalos'}
                        </button>
                    </div>
                </div>

                {/* Integrations Group */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Integrações</h2>
                    <p className={styles.description}>
                        Conexões com serviços externos.
                    </p>

                    <div style={{ marginBottom: '2rem' }}>
                        <label className={styles.label}>OpenAI API Key</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="password"
                                placeholder="sk-..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className={styles.input}
                            />
                            <button
                                onClick={handleSaveKey}
                                disabled={savingKey}
                                className={styles.button}
                            >
                                {savingKey ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className={styles.label}>WhatsApp</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button
                                onClick={handleSyncProfilePics}
                                disabled={syncingPics}
                                className={styles.button}
                                style={{ justifyContent: 'flex-start', backgroundColor: syncingPics ? 'var(--bg-surface)' : 'var(--bg-body)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                            >
                                {syncingPics ? <RefreshCw size={16} className={styles.spin} /> : <Image size={16} />}
                                {syncingPics ? 'Sincronizando...' : 'Sincronizar Fotos de Perfil'}
                            </button>

                            {picsResults && (
                                <div style={{ fontSize: '0.875rem', padding: '0.5rem', background: 'var(--bg-body)', borderRadius: '4px' }}>
                                    {picsResults.error ? (
                                        <span style={{ color: 'var(--danger)' }}>Erro: {picsResults.error}</span>
                                    ) : (
                                        <span style={{ color: 'var(--success)' }}>✓ {picsResults.successCount} fotos atualizadas</span>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={handleSyncHistory}
                                disabled={syncingHistory}
                                className={styles.button}
                                style={{ justifyContent: 'flex-start', backgroundColor: syncingHistory ? 'var(--bg-surface)' : 'var(--bg-body)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                            >
                                {syncingHistory ? <RefreshCw size={16} className={styles.spin} /> : <MessageSquare size={16} />}
                                {syncingHistory ? 'Sincronizando...' : 'Sincronizar Histórico'}
                            </button>

                            {historyResults && (
                                <div style={{ fontSize: '0.875rem', padding: '0.5rem', background: 'var(--bg-body)', borderRadius: '4px' }}>
                                    {historyResults.error ? (
                                        <span style={{ color: 'var(--danger)' }}>Erro: {historyResults.error}</span>
                                    ) : (
                                        <span style={{ color: 'var(--success)' }}>✓ {historyResults.messagesImported} mensagens importadas</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className={`${styles.section} ${styles.dangerZone}`}>
                    <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>
                        <AlertTriangle size={20} />
                        Zona de Perigo
                    </h2>
                    <p className={styles.dangerDescription}>
                        Ações aqui são irreversíveis. Tenha cuidado.
                    </p>

                    <button
                        className={styles.deleteButton}
                        onClick={handleDeleteAll}
                        disabled={deleting}
                    >
                        <Trash2 size={18} />
                        {deleting ? 'Apagando...' : 'Apagar Todos os Contatos'}
                    </button>
                </div>
            </div>
        </div>
    );
}
