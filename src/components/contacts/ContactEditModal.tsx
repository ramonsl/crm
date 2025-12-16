/**
 * ContactEditModal - Modal for editing contact information
 */

'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import type { Contact } from '@/types/contacts';
import type { Status } from '@/types/status';
import styles from './ContactEditModal.module.css';

interface ContactEditModalProps {
    contact: Contact | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (contact: Contact) => void;
}

export function ContactEditModal({ contact, isOpen, onClose, onSave }: ContactEditModalProps) {
    const { success, error: toastError } = useToast();
    const [formData, setFormData] = useState<Partial<Contact>>({});
    const [saving, setSaving] = useState(false);
    const [statuses, setStatuses] = useState<Status[]>([]);
    const [loadingStatuses, setLoadingStatuses] = useState(true);

    const isCreating = !contact;

    // Load statuses from API
    useEffect(() => {
        const loadStatuses = async () => {
            try {
                const response = await fetch('/api/statuses');
                if (response.ok) {
                    const data = await response.json();
                    setStatuses(data.statuses || []);
                }
            } catch (error) {
                console.error('Error loading statuses:', error);
            } finally {
                setLoadingStatuses(false);
            }
        };
        loadStatuses();
    }, []);

    useEffect(() => {
        if (contact) {
            setFormData(contact);
        } else {
            // Reset form for new contact - use first status as default
            const defaultStatus = statuses[0]?.name || 'Novo';
            setFormData({
                status: defaultStatus
            });
        }
    }, [contact, isOpen, statuses]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const method = isCreating ? 'POST' : 'PUT';
            const body = isCreating
                ? formData
                : { ...formData, originalCpf: contact?.cpf };

            const response = await fetch('/api/leads', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const data = await response.json();
                success(isCreating ? 'Contato criado com sucesso!' : 'Contato atualizado com sucesso!');
                onSave(data.data);
                onClose();
            } else {
                const errorData = await response.json();
                toastError(`Erro ao salvar: ${errorData.error}`);
            }
        } catch (err) {
            console.error('Save error:', err);
            toastError('Erro ao salvar contato');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>{isCreating ? 'Adicionar Contato' : 'Editar Contato'}</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label>Nome *</label>
                        <input
                            type="text"
                            value={formData.nome || ''}
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            required
                        />
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>CPF</label>
                            <input
                                type="text"
                                value={formData.cpf || ''}
                                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                                placeholder="Opcional"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Telefone *</label>
                            <input
                                type="text"
                                value={formData.telefone || ''}
                                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Email</label>
                        <input
                            type="email"
                            value={formData.email || ''}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>Status</label>
                            <select
                                value={formData.status || ''}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                disabled={loadingStatuses}
                            >
                                {loadingStatuses ? (
                                    <option value="">Carregando...</option>
                                ) : (
                                    statuses.map((status) => (
                                        <option key={status.id} value={status.name}>
                                            {status.name}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Semestre</label>
                            <input
                                type="text"
                                value={formData.tipo_ingresso || ''}
                                onChange={(e) => setFormData({ ...formData, tipo_ingresso: e.target.value })}
                                placeholder="Ex: 2025/1"
                            />
                        </div>
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>Curso de Interesse</label>
                            <input
                                type="text"
                                value={formData.curso_interesse || ''}
                                onChange={(e) => setFormData({ ...formData, curso_interesse: e.target.value })}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Escola</label>
                            <input
                                type="text"
                                value={formData.escola || ''}
                                onChange={(e) => setFormData({ ...formData, escola: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button type="button" onClick={onClose} className={styles.cancelButton}>
                            Cancelar
                        </button>
                        <button type="submit" className={styles.saveButton} disabled={saving}>
                            {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
