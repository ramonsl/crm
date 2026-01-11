'use client';

import { useState } from 'react';
import styles from './GeneralSettings.module.css';
import { Save, RefreshCw, Image, MessageSquare } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import type { SyncResults } from '@/types/settings';

export function GeneralSettings() {
    const { settings, updateSetting, toast } = useSettings();

    const [apiKey, setApiKey] = useState(settings.openaiApiKey || '');
    const [minDelay, setMinDelay] = useState(settings.minDelay || 30);
    const [maxDelay, setMaxDelay] = useState(settings.maxDelay || 60);
    const [metaMatriculas, setMetaMatriculas] = useState(settings.metaMatriculas || 0);
    const [comercialPhone, setComercialPhone] = useState(settings.comercialPhone || '');
    const [comercialName, setComercialName] = useState(settings.comercialName || '');

    const [savingKey, setSavingKey] = useState(false);
    const [savingDelays, setSavingDelays] = useState(false);
    const [savingMeta, setSavingMeta] = useState(false);
    const [savingComercial, setSavingComercial] = useState(false);
    const [syncingPics, setSyncingPics] = useState(false);
    const [syncingHistory, setSyncingHistory] = useState(false);
    const [picsResults, setPicsResults] = useState<SyncResults | null>(null);
    const [historyResults, setHistoryResults] = useState<SyncResults | null>(null);

    const handleSaveKey = async () => {
        setSavingKey(true);
        const success = await updateSetting('openaiApiKey', apiKey);
        setSavingKey(false);
    };

    const handleSaveDelays = async () => {
        if (minDelay < 1 || maxDelay < minDelay) {
            toast.warning('Valores inválidos. O mínimo deve ser >= 1 e o máximo >= mínimo.');
            return;
        }
        setSavingDelays(true);
        await updateSetting('minDelay', minDelay);
        await updateSetting('maxDelay', maxDelay);
        setSavingDelays(false);
    };

    const handleSaveMeta = async () => {
        setSavingMeta(true);
        await updateSetting('metaMatriculas', metaMatriculas);
        setSavingMeta(false);
    };

    const handleSaveComercial = async () => {
        if (!comercialName.trim() || !comercialPhone.trim()) {
            toast.warning('Preencha o nome e telefone do comercial.');
            return;
        }
        setSavingComercial(true);
        await updateSetting('comercialName', comercialName);
        await updateSetting('comercialPhone', comercialPhone);
        setSavingComercial(false);
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
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className={styles.input}
                    />
                    <button onClick={handleSaveKey} disabled={savingKey} className={styles.primaryButton}>
                        <Save size={16} />
                        {savingKey ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </section>

            {/* Delays */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Delays de Mensagens (segundos)</h3>
                <div className={styles.row}>
                    <div className={styles.field}>
                        <label className={styles.label}>Mínimo</label>
                        <input
                            type="number"
                            value={minDelay}
                            onChange={(e) => setMinDelay(Number(e.target.value))}
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Máximo</label>
                        <input
                            type="number"
                            value={maxDelay}
                            onChange={(e) => setMaxDelay(Number(e.target.value))}
                            className={styles.input}
                        />
                    </div>
                </div>
                <button onClick={handleSaveDelays} disabled={savingDelays} className={styles.primaryButton}>
                    <Save size={16} />
                    {savingDelays ? 'Salvando...' : 'Salvar Delays'}
                </button>
            </section>

            {/* Meta Matrículas */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Meta de Matrículas</h3>
                <div className={styles.inputGroup}>
                    <input
                        type="number"
                        value={metaMatriculas}
                        onChange={(e) => setMetaMatriculas(Number(e.target.value))}
                        className={styles.input}
                    />
                    <button onClick={handleSaveMeta} disabled={savingMeta} className={styles.primaryButton}>
                        <Save size={16} />
                        {savingMeta ? 'Salvando...' : 'Salvar Meta'}
                    </button>
                </div>
            </section>

            {/* Time Comercial */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Time Comercial</h3>
                <div className={styles.field}>
                    <label className={styles.label}>Nome</label>
                    <input
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
                        type="text"
                        value={comercialPhone}
                        onChange={(e) => setComercialPhone(e.target.value)}
                        placeholder="5511999999999"
                        className={styles.input}
                    />
                </div>
                <button onClick={handleSaveComercial} disabled={savingComercial} className={styles.primaryButton}>
                    <Save size={16} />
                    {savingComercial ? 'Salvando...' : 'Salvar Comercial'}
                </button>
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
        </div>
    );
}
