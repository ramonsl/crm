'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { Trash2, AlertTriangle, RefreshCw, Image, MessageSquare, Plus, Palette, GripVertical, Save, X, Users, Phone } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { YCloudSettings } from '@/components/settings/YCloudSettings';

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

    // Commercial team settings
    const [comercialPhone, setComercialPhone] = useState('');
    const [comercialName, setComercialName] = useState('');
    const [savingComercial, setSavingComercial] = useState(false);

    // WhatsApp sync states
    const [syncingPics, setSyncingPics] = useState(false);
    const [picsResults, setPicsResults] = useState<any>(null);
    const [syncingHistory, setSyncingHistory] = useState(false);
    const [historyResults, setHistoryResults] = useState<any>(null);

    // Status management states
    interface StatusItem {
        id: number;
        name: string;
        color: string;
        display_order: number;
    }
    const [statuses, setStatuses] = useState<StatusItem[]>([]);
    const [loadingStatuses, setLoadingStatuses] = useState(false);
    const [editingStatus, setEditingStatus] = useState<StatusItem | null>(null);
    const [newStatusName, setNewStatusName] = useState('');
    const [newStatusColor, setNewStatusColor] = useState('#6b7280');

    // Duplicates management states
    interface DuplicateGroup {
        telefone: string;
        registros: Array<{
            cpf: string;
            nome: string;
            email: string | null;
            status: string;
            tipo_ingresso: string | null;
            created_at: string;
            updated_at: string;
        }>;
    }
    const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
    const [loadingDuplicates, setLoadingDuplicates] = useState(false);
    const [mergingDuplicates, setMergingDuplicates] = useState(false);
    const [mergeConfirmGroup, setMergeConfirmGroup] = useState<DuplicateGroup | null>(null);

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.openaiApiKey) setApiKey(data.openaiApiKey);
                if (data.minDelay) setMinDelay(Number(data.minDelay));
                if (data.maxDelay) setMaxDelay(Number(data.maxDelay));
                if (data.metaMatriculas) setMetaMatriculas(Number(data.metaMatriculas));
                if (data.comercialPhone) setComercialPhone(data.comercialPhone);
                if (data.comercialName) setComercialName(data.comercialName);
            });

        // Fetch statuses
        fetchStatuses();
    }, []);

    const fetchStatuses = async () => {
        setLoadingStatuses(true);
        try {
            const res = await fetch('/api/statuses');
            const data = await res.json();
            setStatuses(data.data || []);
        } catch (error) {
            console.error('Error fetching statuses:', error);
        } finally {
            setLoadingStatuses(false);
        }
    };

    const fetchDuplicates = async () => {
        setLoadingDuplicates(true);
        try {
            const res = await fetch('/api/duplicates');
            const data = await res.json();
            setDuplicates(data.duplicates || []);
        } catch (error) {
            console.error('Error fetching duplicates:', error);
            toastError('Erro ao buscar duplicatas');
        } finally {
            setLoadingDuplicates(false);
        }
    };

    const handleMergeDuplicates = async (group: DuplicateGroup) => {
        if (group.registros.length < 2) return;
        // Abrir modal de confirmação
        setMergeConfirmGroup(group);
    };

    const executeMerge = async () => {
        if (!mergeConfirmGroup) return;

        const group = mergeConfirmGroup;
        const primaryCpf = group.registros[0].cpf;
        const secondaryCpfs = group.registros.slice(1).map(r => r.cpf);

        setMergeConfirmGroup(null); // Fechar modal
        setMergingDuplicates(true);

        try {
            const res = await fetch('/api/duplicates/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ primaryCpf, secondaryCpfs })
            });

            if (res.ok) {
                toastSuccess(`${secondaryCpfs.length} registro(s) mesclado(s) com sucesso!`);
                fetchDuplicates();
            } else {
                const data = await res.json();
                toastError(data.error || 'Erro ao mesclar');
            }
        } catch (error) {
            console.error('Error merging duplicates:', error);
            toastError('Erro ao mesclar duplicatas');
        } finally {
            setMergingDuplicates(false);
        }
    };

    const handleAddStatus = async () => {
        if (!newStatusName.trim()) {
            toastWarning('Digite um nome para o status');
            return;
        }

        try {
            const res = await fetch('/api/statuses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newStatusName, color: newStatusColor })
            });

            if (res.ok) {
                toastSuccess('Status adicionado!');
                setNewStatusName('');
                setNewStatusColor('#6b7280');
                fetchStatuses();
            } else {
                const data = await res.json();
                toastError(data.error || 'Erro ao adicionar status');
            }
        } catch (error) {
            toastError('Erro ao adicionar status');
        }
    };

    const handleUpdateStatus = async (status: StatusItem) => {
        try {
            const res = await fetch('/api/statuses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: status.id, name: status.name, color: status.color })
            });

            if (res.ok) {
                toastSuccess('Status atualizado!');
                setEditingStatus(null);
                fetchStatuses();
            } else {
                toastError('Erro ao atualizar status');
            }
        } catch (error) {
            toastError('Erro ao atualizar status');
        }
    };

    const handleDeleteStatus = async (id: number) => {
        if (!confirm('Tem certeza que deseja remover este status?')) return;

        try {
            const res = await fetch(`/api/statuses?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toastSuccess('Status removido!');
                fetchStatuses();
            } else {
                toastError('Erro ao remover status');
            }
        } catch (error) {
            toastError('Erro ao remover status');
        }
    };

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

    const handleSaveComercial = async () => {
        if (!comercialName.trim() || !comercialPhone.trim()) {
            toastWarning('Preencha o nome e telefone do comercial.');
            return;
        }

        setSavingComercial(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comercialName, comercialPhone })
            });
            if (res.ok) {
                toastSuccess('Dados do comercial salvos!');
            } else {
                toastError('Erro ao salvar dados do comercial.');
            }
        } catch (error) {
            console.error(error);
            toastError('Erro ao salvar.');
        } finally {
            setSavingComercial(false);
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

                {/* Commercial Team */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <Phone size={20} />
                        Equipe Comercial
                    </h2>
                    <p className={styles.description}>
                        Configure o contato do comercial para encaminhamento de leads.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label className={styles.label}>Nome do Comercial</label>
                            <input
                                type="text"
                                placeholder="Ex: João - Comercial"
                                value={comercialName}
                                onChange={(e) => setComercialName(e.target.value)}
                                className={styles.input}
                            />
                        </div>
                        <div>
                            <label className={styles.label}>Telefone (WhatsApp)</label>
                            <input
                                type="text"
                                placeholder="Ex: 5511999999999"
                                value={comercialPhone}
                                onChange={(e) => setComercialPhone(e.target.value)}
                                className={styles.input}
                            />
                        </div>
                        <button
                            onClick={handleSaveComercial}
                            disabled={savingComercial}
                            className={styles.button}
                        >
                            {savingComercial ? 'Salvando...' : 'Salvar Comercial'}
                        </button>
                    </div>
                </div>

                {/* Status Management */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <Palette size={20} />
                        Gerenciar Status
                    </h2>
                    <p className={styles.description}>
                        Configure os status disponíveis e suas cores.
                    </p>

                    {/* Add New Status */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <input
                            type="text"
                            placeholder="Nome do novo status"
                            value={newStatusName}
                            onChange={(e) => setNewStatusName(e.target.value)}
                            className={styles.input}
                            style={{ flex: 1 }}
                        />
                        <input
                            type="color"
                            value={newStatusColor}
                            onChange={(e) => setNewStatusColor(e.target.value)}
                            style={{ width: '50px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                        />
                        <button
                            onClick={handleAddStatus}
                            className={styles.button}
                            style={{ gap: '0.25rem' }}
                        >
                            <Plus size={16} />
                            Adicionar
                        </button>
                    </div>

                    {/* Status List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {loadingStatuses ? (
                            <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
                        ) : statuses.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>Nenhum status cadastrado</p>
                        ) : (
                            statuses.map((status) => (
                                <div
                                    key={status.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem',
                                        background: 'var(--bg-body)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)'
                                    }}
                                >
                                    <GripVertical size={16} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />

                                    {editingStatus?.id === status.id ? (
                                        <>
                                            <input
                                                type="text"
                                                value={editingStatus.name}
                                                onChange={(e) => setEditingStatus({ ...editingStatus, name: e.target.value })}
                                                className={styles.input}
                                                style={{ flex: 1 }}
                                            />
                                            <input
                                                type="color"
                                                value={editingStatus.color}
                                                onChange={(e) => setEditingStatus({ ...editingStatus, color: e.target.value })}
                                                style={{ width: '40px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                            />
                                            <button
                                                onClick={() => handleUpdateStatus(editingStatus)}
                                                style={{ background: 'var(--success)', border: 'none', borderRadius: '4px', padding: '0.5rem', cursor: 'pointer' }}
                                            >
                                                <Save size={16} style={{ color: 'white' }} />
                                            </button>
                                            <button
                                                onClick={() => setEditingStatus(null)}
                                                style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.5rem', cursor: 'pointer' }}
                                            >
                                                <X size={16} style={{ color: 'var(--text-muted)' }} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span
                                                style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '50%',
                                                    backgroundColor: status.color,
                                                    flexShrink: 0
                                                }}
                                            />
                                            <span style={{ flex: 1, color: 'var(--text-main)' }}>{status.name}</span>
                                            <button
                                                onClick={() => setEditingStatus(status)}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                                                title="Editar"
                                            >
                                                <Palette size={16} style={{ color: 'var(--text-muted)' }} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteStatus(status.id)}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                                                title="Remover"
                                            >
                                                <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
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

                {/* YCloud WhatsApp Provider */}
                <YCloudSettings styles={styles} />

                {/* Duplicate Management */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <Users size={20} />
                        Gerenciar Duplicatas
                    </h2>
                    <p className={styles.description}>
                        Encontre e mescle registros com o mesmo telefone.
                    </p>

                    <button
                        onClick={fetchDuplicates}
                        disabled={loadingDuplicates}
                        className={styles.button}
                        style={{ marginBottom: '1rem' }}
                    >
                        {loadingDuplicates ? <RefreshCw size={16} className={styles.spin} /> : <Users size={16} />}
                        {loadingDuplicates ? 'Buscando...' : 'Buscar Duplicatas'}
                    </button>

                    {duplicates.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <p style={{ color: 'var(--warning)', fontSize: '0.875rem' }}>
                                ⚠️ Encontrados {duplicates.length} grupos de duplicatas
                            </p>
                            {duplicates.slice(0, 10).map((group) => (
                                <div
                                    key={group.telefone}
                                    style={{
                                        padding: '0.75rem',
                                        background: 'var(--bg-body)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                            📱 {group.telefone}
                                        </span>
                                        <button
                                            onClick={() => handleMergeDuplicates(group)}
                                            disabled={mergingDuplicates}
                                            style={{
                                                background: 'var(--primary)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '0.25rem 0.5rem',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {mergingDuplicates ? 'Mesclando...' : 'Mesclar'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        {group.registros.map((reg, idx) => (
                                            <div
                                                key={reg.cpf}
                                                style={{
                                                    fontSize: '0.75rem',
                                                    color: idx === 0 ? 'var(--success)' : 'var(--text-muted)',
                                                    display: 'flex',
                                                    gap: '0.5rem'
                                                }}
                                            >
                                                <span>{idx === 0 ? '✓' : '○'}</span>
                                                <span>{reg.nome || 'Sem nome'}</span>
                                                <span>({reg.status})</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {duplicates.length > 10 && (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                    ... e mais {duplicates.length - 10} grupos
                                </p>
                            )}
                        </div>
                    )}

                    {duplicates.length === 0 && !loadingDuplicates && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            Clique em &quot;Buscar Duplicatas&quot; para verificar
                        </p>
                    )}
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

            {/* Modal de Confirmação de Merge */}
            {mergeConfirmGroup && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'var(--bg-surface)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        maxWidth: '400px',
                        width: '90%',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>
                            Confirmar Merge
                        </h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            Mesclar {mergeConfirmGroup.registros.length} registros com telefone <strong>{mergeConfirmGroup.telefone}</strong>?
                        </p>
                        <p style={{ color: 'var(--success)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            ✓ <strong>{mergeConfirmGroup.registros[0].nome || 'Sem nome'}</strong> será mantido
                        </p>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.75rem' }}>
                            Os demais registros serão mesclados e removidos.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setMergeConfirmGroup(null)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    padding: '0.5rem 1rem',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeMerge}
                                disabled={mergingDuplicates}
                                style={{
                                    background: 'var(--primary)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.5rem 1rem',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                {mergingDuplicates ? 'Mesclando...' : 'Confirmar Merge'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
