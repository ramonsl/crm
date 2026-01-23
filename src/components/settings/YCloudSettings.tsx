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
    const [phoneNumber, setPhoneNumber] = useState('');
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
    const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);
    const [fetchingNumbers, setFetchingNumbers] = useState(false);

    // Controle de mudanças não salvas
    const [initialValues, setInitialValues] = useState({ apiKey: '', wabaId: '', phoneId: '', phoneNumber: '' });

    // Cálculo de mudanças não salvas como estado derivado
    const hasUnsavedChanges = !loading ? (
        apiKey !== initialValues.apiKey ||
        wabaId !== initialValues.wabaId ||
        phoneId !== initialValues.phoneId ||
        phoneNumber !== initialValues.phoneNumber
    ) : false;

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                const values = {
                    apiKey: data.yCloudApiKey || '',
                    wabaId: data.yCloudWabaId || '',
                    phoneId: data.yCloudPhoneId || '',
                    phoneNumber: data.yCloudPhoneNumber || ''
                };
                setApiKey(values.apiKey);
                setWabaId(values.wabaId);
                setPhoneId(values.phoneId);
                setPhoneNumber(values.phoneNumber);
                setInitialValues(values);
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
            const payload: any = {
                ycloud_waba_id: wabaId.trim(),
                ycloud_phone_id: phoneId.trim(),
                ycloud_phone_number: phoneNumber.trim()
            };

            // Only send API Key if it's not masked (modified by user)
            if (!apiKey.startsWith('***')) {
                payload.ycloud_api_key = apiKey.trim();
            }

            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toastSuccess('Credenciais YCloud salvas!');
                setInitialValues({ apiKey, wabaId, phoneId, phoneNumber });
            } else {
                toastError('Erro ao salvar credenciais');
            }
        } catch {
            toastError('Erro ao salvar credenciais');
        } finally {
            setSaving(false);
        }
    };
    const handleFetchNumbers = async () => {
        if (!apiKey || !wabaId) {
            toastWarning('Preencha API Key e WABA ID primeiro');
            return;
        }

        setFetchingNumbers(true);
        setAvailableNumbers([]);
        try {
            const res = await fetch('/api/ycloud/phone-numbers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, wabaId })
            });

            const data = await res.json();

            if (res.ok && data.numbers) {
                setAvailableNumbers(data.numbers);
                if (data.numbers.length === 0) {
                    toastWarning('Nenhum número encontrado para esta conta.');
                } else {
                    toastSuccess(`${data.numbers.length} número(s) encontrado(s)!`);
                }
            } else {
                toastError(data.error || 'Erro ao buscar números');
            }
        } catch (error) {
            toastError('Falha ao conectar para buscar números');
        } finally {
            setFetchingNumbers(false);
        }
    };

    const handleSelectNumber = (numberObj: any) => {
        setPhoneId(numberObj.id);
        setPhoneNumber(numberObj.phoneNumber);
        setAvailableNumbers([]); // Close selection list
        toastSuccess(`Phone ID selecionado: ${numberObj.phoneNumber}`);
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
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label className={styles.label}>Phone ID (ID do Telefone)</label>
                            <input
                                type="text"
                                placeholder="Ex: 123456789012345"
                                value={phoneId}
                                onChange={(e) => setPhoneId(e.target.value)}
                                className={styles.input}
                            />
                        </div>
                        <button
                            onClick={handleFetchNumbers}
                            disabled={fetchingNumbers || !apiKey || !wabaId}
                            className={styles.secondaryButton}
                            style={{
                                height: '42px',
                                padding: '0 16px',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                borderRadius: '6px'
                            }}
                            title="Buscar números automaticamente"
                        >
                            {fetchingNumbers ? <RefreshCw size={16} className={styles.spin} /> : '🔍 Buscar'}
                        </button>
                    </div>

                    {/* Available Numbers Selection List */}
                    {availableNumbers.length > 0 && (
                        <div style={{
                            marginTop: '8px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '8px',
                            background: 'var(--bg-highlight)'
                        }}>
                            <p style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>Selecione um número:</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {availableNumbers.map(num => (
                                    <button
                                        key={num.id}
                                        onClick={() => handleSelectNumber(num)}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '4px',
                                            background: 'var(--bg-body)',
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{num.phoneNumber}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{num.name}</div>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px' }}>
                                            ID: {num.id}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
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

            {/* Botão único de salvar no rodapé */}
            <div className={styles.footer}>
                <button
                    onClick={handleSave}
                    disabled={saving || !hasUnsavedChanges}
                    className={styles.saveButton}
                >
                    <Save size={16} />
                    {saving ? 'Salvando...' : 'Salvar Credenciais'}
                </button>
                {hasUnsavedChanges && (
                    <span className={styles.unsavedIndicator}>
                        • Alterações não salvas
                    </span>
                )}
            </div>
        </div>
    );
}
