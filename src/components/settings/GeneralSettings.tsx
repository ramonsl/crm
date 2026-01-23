'use client';

import { useState, useEffect } from 'react';
import styles from './GeneralSettings.module.css';
import { Save, RefreshCw, Image, MessageSquare } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import type { SyncResults } from '@/types/settings';

export function GeneralSettings() {
    const { settings, loading, updateSetting, toast } = useSettings();

    // Estados locais inicializados vazios
    const [apiKey, setApiKey] = useState('');
    const [minDelay, setMinDelay] = useState(30);
    const [maxDelay, setMaxDelay] = useState(60);
    const [metaMatriculas, setMetaMatriculas] = useState(0);
    const [comercialPhone, setComercialPhone] = useState('');
    const [comercialName, setComercialName] = useState('');
    const [whatsappProvider, setWhatsappProvider] = useState('baileys');

    // Cálculo de mudanças não salvas como estado derivado (mais robusto que useEffect)
    const hasUnsavedChanges = !loading && settings ? (
        apiKey !== (settings.openaiApiKey || '') ||
        minDelay !== (settings.minDelay || 30) ||
        maxDelay !== (settings.maxDelay || 60) ||
        metaMatriculas !== (settings.metaMatriculas || 0) ||
        comercialPhone !== (settings.comercialPhone || '') ||
        comercialName !== (settings.comercialName || '') ||
        whatsappProvider !== (settings.whatsappProvider || 'baileys')
    ) : false;

    const [saving, setSaving] = useState(false);
    const [syncingPics, setSyncingPics] = useState(false);
    const [syncingHistory, setSyncingHistory] = useState(false);
    const [picsResults, setPicsResults] = useState<SyncResults | null>(null);
    const [historyResults, setHistoryResults] = useState<SyncResults | null>(null);

    // Sincronizar estados quando dados do banco chegarem (Apenas inicialização)
    const [initialized, setInitialized] = useState(false);
    useEffect(() => {
        if (!loading && settings && !initialized) {
            setApiKey(settings.openaiApiKey || '');
            setMinDelay(settings.minDelay || 30);
            setMaxDelay(settings.maxDelay || 60);
            setMetaMatriculas(settings.metaMatriculas || 0);
            setComercialPhone(settings.comercialPhone || '');
            setComercialName(settings.comercialName || '');
            setWhatsappProvider(settings.whatsappProvider || 'baileys');
            setInitialized(true);
        }
    }, [settings, loading, initialized]);

    // Salvar todas as configurações de uma vez
    const handleSaveAll = async () => {
        // Validações
        if (minDelay < 1 || maxDelay < minDelay) {
            toast.warning('Valores de delay inválidos. O mínimo deve ser >= 1 e o máximo >= mínimo.');
            return;
        }
        if (!comercialName.trim() || !comercialPhone.trim()) {
            toast.warning('Preencha o nome e telefone do comercial.');
            return;
        }

        setSaving(true);
        try {
            await Promise.all([
                updateSetting('openaiApiKey', apiKey),
                updateSetting('minDelay', minDelay),
                updateSetting('maxDelay', maxDelay),
                updateSetting('metaMatriculas', metaMatriculas),
                updateSetting('comercialName', comercialName),
                updateSetting('comercialPhone', comercialPhone),
                updateSetting('whatsappProvider', whatsappProvider),
            ]);
        } finally {
            setSaving(false);
        }
    };

    const handleSyncProfilePics = async () => {
        setSyncingPics(true);
        setPicsResults(null);
        try {
            const res = await fetch('/api/whatsapp/sync-profile-pics', { method: 'POST' });
            const data = await res.json();
            setPicsResults(data);
        } catch (error) {
            setPicsResults({ success: false, message: 'Falha ao sincronizar fotos de perfil' });
        } finally {
            setSyncingPics(false);
        }
    };

    const handleSyncHistory = async () => {
        setSyncingHistory(true);
        setHistoryResults(null);
        try {
            const res = await fetch('/api/whatsapp/sync-history', { method: 'POST' });
            const data = await res.json();
            setHistoryResults(data);
        } catch (error) {
            setHistoryResults({ success: false, message: 'Falha ao sincronizar histórico' });
        } finally {
            setSyncingHistory(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* OpenAI API Key */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Chave API OpenAI</h3>
                <div className={styles.inputGroup}>
                    <input
                        id="openaiApiKey"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className={styles.input}
                    />
                </div>
            </section>

            {/* Delays */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Delays de Mensagens (segundos)</h3>
                <div className={styles.row}>
                    <div className={styles.field}>
                        <label className={styles.label}>Mínimo</label>
                        <input
                            id="minDelay"
                            type="number"
                            value={minDelay}
                            onChange={(e) => setMinDelay(Number(e.target.value))}
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Máximo</label>
                        <input
                            id="maxDelay"
                            type="number"
                            value={maxDelay}
                            onChange={(e) => setMaxDelay(Number(e.target.value))}
                            className={styles.input}
                        />
                    </div>
                </div>
            </section>

            {/* Meta Matrículas */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Meta de Matrículas</h3>
                <div className={styles.inputGroup}>
                    <input
                        id="metaMatriculas"
                        type="number"
                        value={metaMatriculas}
                        onChange={(e) => setMetaMatriculas(Number(e.target.value))}
                        className={styles.input}
                    />
                </div>
            </section>

            {/* Time Comercial */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Time Comercial</h3>
                <div className={styles.field}>
                    <label className={styles.label}>Nome</label>
                    <input
                        id="comercialName"
                        type="text"
                        value={comercialName}
                        onChange={(e) => setComercialName(e.target.value)}
                        placeholder="Nome do comercial"
                        className={styles.input}
                    />
                </div>
                <div className={styles.field}>
                    <label className={styles.label}>Telefone</label>
                    <input
                        id="comercialPhone"
                        type="text"
                        value={comercialPhone}
                        onChange={(e) => setComercialPhone(e.target.value)}
                        placeholder="5511999999999"
                        className={styles.input}
                    />
                </div>
            </section>

            {/* Provedor WhatsApp */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Provedor WhatsApp Principal</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Escolha qual tecnologia será usada para o chat e automações.
                </p>
                <div className={styles.field}>
                    <select
                        value={whatsappProvider}
                        onChange={(e) => setWhatsappProvider(e.target.value)}
                        className={styles.input}
                    >
                        <option value="baileys">Baileys (QR Code - Estável)</option>
                        <option value="wwebjs">WhatsApp Web JS (QR Code)</option>
                        <option value="ycloud">YCloud (API Oficial - Business)</option>
                        <option value="wppconnect">WPPConnect (QR Code)</option>
                    </select>
                </div>
            </section>

            {/* WhatsApp Sync */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Sincronização WhatsApp</h3>
                <div className={styles.syncButtons}>
                    <button onClick={handleSyncProfilePics} disabled={syncingPics} className={styles.secondaryButton}>
                        <Image size={16} />
                        {syncingPics ? 'Sincronizando...' : 'Sincronizar Fotos de Perfil'}
                    </button>
                    <button onClick={handleSyncHistory} disabled={syncingHistory} className={styles.secondaryButton}>
                        <MessageSquare size={16} />
                        {syncingHistory ? 'Sincronizando...' : 'Sincronizar Histórico'}
                    </button>
                </div>
                {picsResults && (
                    <div className={picsResults.success ? styles.successMessage : styles.errorMessage}>
                        {picsResults.message || `Atualizado: ${picsResults.updated}, Falhou: ${picsResults.failed}`}
                    </div>
                )}
                {historyResults && (
                    <div className={historyResults.success ? styles.successMessage : styles.errorMessage}>
                        {historyResults.message || `Atualizado: ${historyResults.updated}, Falhou: ${historyResults.failed}`}
                    </div>
                )}
            </section>

            {/* Botão único de salvar no rodapé */}
            <div className={styles.footer}>
                <button
                    onClick={handleSaveAll}
                    disabled={saving || !hasUnsavedChanges}
                    className={styles.saveButton}
                >
                    <Save size={16} />
                    {saving ? 'Salvando...' : 'Salvar Configurações'}
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
