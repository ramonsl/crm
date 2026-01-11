/**
 * YCloudSettings Component
 * 
 * Settings section for YCloud WhatsApp API credentials.
 * Provider is auto-selected based on template type in BulkMessageModal:
 * - Local templates / custom → WhatsAppJS
 * - YCloud templates → YCloud API
 */

'use client';

import { useState, useEffect } from 'react';
import { Cloud, RefreshCw, CheckCircle, XCircle, Save, Info } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import styles from './YCloudSettings.module.css';

export function YCloudSettings() {
    const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const [apiKey, setApiKey] = useState('');
    const [wabaId, setWabaId] = useState('');
    const [phoneId, setPhoneId] = useState('');
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.yCloudApiKey) setApiKey(data.yCloudApiKey);
                if (data.yCloudWabaId) setWabaId(data.yCloudWabaId);
                if (data.yCloudPhoneId) setPhoneId(data.yCloudPhoneId);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        if (!apiKey || !wabaId || !phoneId) {
            toastWarning('Preencha todas as credenciais');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ycloud_api_key: apiKey,
                    ycloud_waba_id: wabaId,
                    ycloud_phone_id: phoneId
                })
            });

            if (res.ok) {
                toastSuccess('Credenciais YCloud salvas!');
            } else {
                toastError('Erro ao salvar credenciais');
            }
        } catch {
            toastError('Erro ao salvar credenciais');
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!apiKey || !wabaId) {
            toastWarning('Configure API Key e WABA ID antes de testar');
            return;
        }

        setTesting(true);
        setTestResult(null);

        try {
            const res = await fetch('/api/ycloud-templates/sync', { method: 'POST' });

            if (res.ok) {
                setTestResult('success');
                toastSuccess('Conexão com YCloud OK!');
            } else {
                const data = await res.json();
                setTestResult('error');
                toastError(data.error || 'Falha na conexão');
            }
        } catch {
            setTestResult('error');
            toastError('Erro ao testar conexão');
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <Cloud size={20} />
                    YCloud WhatsApp API
                </h2>
                <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
            </div>
        );
    }

    return (
        <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
                <Cloud size={20} />
                YCloud WhatsApp API
            </h2>
            <p className={styles.description}>
                Configure as credenciais para envio via YCloud (templates aprovados).
            </p>

            {/* Info about how provider selection works */}
            <div className={styles.infoBox}>
                <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                    <strong>Como funciona:</strong><br />
                    O provedor é escolhido automaticamente no envio em massa:<br />
                    • Mensagem livre / Modelo local → WhatsApp Web<br />
                    • Template YCloud → YCloud API
                </div>
            </div>

            {/* YCloud Credentials */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', background: 'var(--bg-body)', borderRadius: '8px', marginBottom: '1rem' }}>
                <div>
                    <label className={styles.label}>API Key</label>
                    <input
                        type="password"
                        placeholder="Sua API Key do YCloud"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className={styles.input}
                    />
                </div>
                <div>
                    <label className={styles.label}>WABA ID (WhatsApp Business Account)</label>
                    <input
                        type="text"
                        placeholder="Ex: 123456789012345"
                        value={wabaId}
                        onChange={(e) => setWabaId(e.target.value)}
                        className={styles.input}
                    />
                </div>
                <div>
                    <label className={styles.label}>Phone ID (ID do Telefone)</label>
                    <input
                        type="text"
                        placeholder="Ex: 123456789012345"
                        value={phoneId}
                        onChange={(e) => setPhoneId(e.target.value)}
                        className={styles.input}
                    />
                </div>

                {/* Test Connection */}
                <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className={styles.button}
                    style={{
                        justifyContent: 'center',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)'
                    }}
                >
                    {testing ? (
                        <>
                            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                            Testando...
                        </>
                    ) : testResult === 'success' ? (
                        <>
                            <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                            Conexão OK
                        </>
                    ) : testResult === 'error' ? (
                        <>
                            <XCircle size={16} style={{ color: 'var(--danger)' }} />
                            Falha - Verificar credenciais
                        </>
                    ) : (
                        <>
                            <RefreshCw size={16} />
                            Testar Conexão
                        </>
                    )}
                </button>
            </div>

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={saving}
                className={styles.button}
                style={{ width: '100%' }}
            >
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar Credenciais'}
            </button>
        </div>
    );
}
