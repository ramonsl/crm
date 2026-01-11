'use client';

import { useState } from 'react';
import styles from './DataSettings.module.css';
import { Users, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import type { DuplicateGroup } from '@/types/settings';

export function DataSettings() {
    const { success, error, warning } = useToast();
    const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [merging, setMerging] = useState(false);
    const [confirmGroup, setConfirmGroup] = useState<DuplicateGroup | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchDuplicates = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/duplicates');
            const data = await res.json();
            setDuplicates(data.duplicates || []);
        } catch (err) {
            console.error('Error fetching duplicates:', err);
            error('Erro ao buscar duplicatas');
        } finally {
            setLoading(false);
        }
    };

    const handleMerge = async () => {
        if (!confirmGroup) return;

        const group = confirmGroup;
        const primaryCpf = group.registros[0].cpf;
        const secondaryCpfs = group.registros.slice(1).map(r => r.cpf);

        setConfirmGroup(null);
        setMerging(true);

        try {
            const res = await fetch('/api/duplicates/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ primaryCpf, secondaryCpfs })
            });

            if (res.ok) {
                success(`${secondaryCpfs.length} registro(s) mesclado(s) com sucesso!`);
                fetchDuplicates();
            } else {
                const data = await res.json();
                error(data.error || 'Erro ao mesclar');
            }
        } catch (err) {
            console.error('Error merging:', err);
            error('Erro ao mesclar duplicatas');
        } finally {
            setMerging(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm('TEM CERTEZA? Isso apagará TODOS os contatos permanentemente. Esta ação não pode ser desfeita.')) {
            return;
        }

        const confirmation = prompt('Digite "DELETAR" para confirmar:');
        if (confirmation !== 'DELETAR') {
            warning('Ação cancelada.');
            return;
        }

        setDeleting(true);
        try {
            const res = await fetch('/api/contacts/delete-all', { method: 'DELETE' });
            if (res.ok) {
                success('Todos os contatos foram apagados.');
            } else {
                error('Erro ao apagar contatos.');
            }
        } catch (err) {
            console.error('Error deleting all:', err);
            error('Erro ao apagar contatos.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className={styles.wrapper}>
            {/* Card 1: Duplicates */}
            <section className={styles.card}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>
                            <Users size={20} />
                            Gerenciar Duplicatas
                        </h2>
                        <p className={styles.description}>
                            Encontre e mescle registros com o mesmo telefone.
                        </p>
                    </div>
                    <button
                        onClick={fetchDuplicates}
                        disabled={loading}
                        className={styles.searchButton}
                    >
                        {loading ? <RefreshCw size={16} className={styles.spin} /> : <Users size={16} />}
                        {loading ? 'Buscando...' : 'Buscar Duplicatas'}
                    </button>
                </div>

                {duplicates.length > 0 && (
                    <div className={styles.list}>
                        <p className={styles.warningMessage}>
                            <AlertTriangle size={16} />
                            Encontrados {duplicates.length} grupos de duplicatas
                        </p>

                        {duplicates.slice(0, 10).map((group) => (
                            <div key={group.telefone} className={styles.groupItem}>
                                <div className={styles.groupHeader}>
                                    <span className={styles.phone}>📱 {group.telefone}</span>
                                    <button
                                        onClick={() => setConfirmGroup(group)}
                                        disabled={merging}
                                        className={styles.mergeButton}
                                    >
                                        {merging ? 'Mesclando...' : 'Mesclar'}
                                    </button>
                                </div>
                                <div className={styles.recordsList}>
                                    {group.registros.map((reg, idx) => (
                                        <div
                                            key={reg.cpf}
                                            className={`${styles.record} ${idx === 0 ? styles.primaryRecord : styles.secondaryRecord}`}
                                        >
                                            <span className={styles.recordIcon}>{idx === 0 ? '✓' : '○'}</span>
                                            <span className={styles.recordName}>{reg.nome || 'Sem nome'}</span>
                                            <span className={styles.recordStatus}>({reg.status})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {duplicates.length > 10 && (
                            <p className={styles.moreMessage}>
                                ... e mais {duplicates.length - 10} grupos
                            </p>
                        )}
                    </div>
                )}
            </section>

            {/* Card 2: Danger Zone */}
            <section className={`${styles.card} ${styles.dangerCard}`}>
                <div className={styles.header}>
                    <div>
                        <h2 className={`${styles.title} ${styles.dangerTitle}`}>
                            <AlertTriangle size={20} />
                            Zona de Perigo
                        </h2>
                        <p className={styles.dangerDescription}>
                            Ações irreversíveis que afetam todos os dados.
                        </p>
                    </div>
                </div>

                <div className={styles.dangerActions}>
                    <button
                        onClick={handleDeleteAll}
                        disabled={deleting}
                        className={styles.deleteButton}
                    >
                        <Trash2 size={16} />
                        {deleting ? 'Apagando...' : 'Apagar Todos os Dados'}
                    </button>
                </div>
            </section>

            {/* Modal de Confirmação (Global para o componente) */}
            {confirmGroup && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3 className={styles.modalTitle}>Confirmar Merge</h3>
                        <p className={styles.modalText}>
                            Mesclar {confirmGroup.registros.length} registros com telefone <strong>{confirmGroup.telefone}</strong>?
                        </p>
                        <p className={styles.keepMessage}>
                            ✓ <strong>{confirmGroup.registros[0].nome || 'Sem nome'}</strong> será mantido
                        </p>
                        <p className={styles.removeMessage}>
                            Os demais registros serão mesclados e removidos.
                        </p>
                        <div className={styles.modalActions}>
                            <button
                                onClick={() => setConfirmGroup(null)}
                                className={styles.cancelButton}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleMerge}
                                disabled={merging}
                                className={styles.confirmButton}
                            >
                                {merging ? 'Mesclando...' : 'Confirmar Merge'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
