'use client';

import { useState, useEffect } from 'react';
import styles from './StatusSettings.module.css';
import { Plus, Save, X, Trash2, GripVertical, Palette } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import type { StatusItem } from '@/types/settings';

export function StatusSettings() {
    const { success, error, warning } = useToast();
    const [statuses, setStatuses] = useState<StatusItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingStatus, setEditingStatus] = useState<StatusItem | null>(null);
    const [newStatusName, setNewStatusName] = useState('');
    const [newStatusColor, setNewStatusColor] = useState('#6b7280');
    const [statusToDelete, setStatusToDelete] = useState<StatusItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchStatuses();
    }, []);

    const fetchStatuses = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/statuses');
            const data = await res.json();
            setStatuses(data.data || []);
        } catch (err) {
            console.error('Error fetching statuses:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddStatus = async () => {
        if (!newStatusName.trim()) {
            warning('Digite um nome para o status');
            return;
        }

        try {
            const res = await fetch('/api/statuses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newStatusName, color: newStatusColor })
            });

            if (res.ok) {
                success('Status adicionado!');
                setNewStatusName('');
                setNewStatusColor('#6b7280');
                fetchStatuses();
            } else {
                error('Erro ao adicionar status');
            }
        } catch (err) {
            error('Erro ao adicionar status');
        }
    };

    const handleUpdateStatus = async (status: StatusItem) => {
        try {
            const res = await fetch('/api/statuses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: status.id,
                    name: status.name,
                    color: status.color
                })
            });

            if (res.ok) {
                success('Status atualizado!');
                setEditingStatus(null);
                fetchStatuses();
            } else {
                error('Erro ao atualizar status');
            }
        } catch (err) {
            error('Erro ao atualizar status');
        }
    };

    const handleDeleteClick = (status: StatusItem) => {
        setStatusToDelete(status);
    };

    const confirmDeleteStatus = async () => {
        if (!statusToDelete) return;

        setDeleting(true);
        try {
            const res = await fetch(`/api/statuses?id=${statusToDelete.id}`, { method: 'DELETE' });
            if (res.ok) {
                success('Status removido!');
                setStatusToDelete(null);
                fetchStatuses();
            } else {
                error('Erro ao remover status');
            }
        } catch (err) {
            error('Erro ao remover status');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>
                        <Palette size={20} />
                        Gerenciar Status
                    </h2>
                    <p className={styles.description}>
                        Configure os status disponíveis e suas cores.
                    </p>
                </div>
            </div>

            {/* Add New Status */}
            <div className={styles.addForm}>
                <input
                    id="newStatusName"
                    type="text"
                    placeholder="Nome do novo status"
                    value={newStatusName}
                    onChange={(e) => setNewStatusName(e.target.value)}
                    className={styles.input}
                />
                <input
                    id="newStatusColor"
                    type="color"
                    value={newStatusColor}
                    onChange={(e) => setNewStatusColor(e.target.value)}
                    className={styles.colorPicker}
                />
                <button onClick={handleAddStatus} className={styles.addButton}>
                    <Plus size={16} />
                    Adicionar
                </button>
            </div>

            {/* Status List */}
            <div className={styles.list}>
                {loading ? (
                    <p className={styles.emptyMessage}>Carregando...</p>
                ) : statuses.length === 0 ? (
                    <p className={styles.emptyMessage}>Nenhum status cadastrado</p>
                ) : (
                    statuses.map((status) => (
                        <div key={status.id} className={styles.statusItem} data-status-name={status.name}>
                            <GripVertical size={16} className={styles.dragHandle} />

                            {editingStatus?.id === status.id ? (
                                <>
                                    <input
                                        type="text"
                                        value={editingStatus.name}
                                        onChange={(e) => setEditingStatus({ ...editingStatus, name: e.target.value })}
                                        className={styles.input}
                                    />
                                    <input
                                        type="color"
                                        value={editingStatus.color}
                                        onChange={(e) => setEditingStatus({ ...editingStatus, color: e.target.value })}
                                        className={styles.colorPickerSmall}
                                    />
                                    <button
                                        onClick={() => handleUpdateStatus(editingStatus)}
                                        className={styles.saveButton}
                                        aria-label="Salvar Alterações"
                                    >
                                        <Save size={16} />
                                    </button>
                                    <button onClick={() => setEditingStatus(null)} className={styles.cancelButton}>
                                        <X size={16} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div
                                        className={styles.colorDot}
                                        style={{ backgroundColor: status.color }}
                                    />
                                    <span className={styles.statusName}>{status.name}</span>
                                    <div className={styles.actions}>
                                        <button
                                            onClick={() => setEditingStatus(status)}
                                            className={styles.editButton}
                                            aria-label="Editar Status"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(status)}
                                            className={styles.deleteButton}
                                            aria-label="Excluir Status"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Modal de Confirmação de Exclusão */}
            {statusToDelete && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3 className={styles.modalTitle}>Excluir Status</h3>
                        <p className={styles.modalText}>
                            Tem certeza que deseja excluir o status <strong>{statusToDelete.name}</strong>?
                            <br />
                            Esta ação não pode ser desfeita.
                        </p>
                        <div className={styles.modalActions}>
                            <button
                                onClick={() => setStatusToDelete(null)}
                                className={styles.cancelButton}
                                disabled={deleting}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteStatus}
                                className={styles.confirmButton}
                                disabled={deleting}
                            >
                                {deleting ? 'Excluindo...' : 'Excluir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
