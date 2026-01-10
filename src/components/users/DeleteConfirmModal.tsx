'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import styles from '@/app/usuarios/Users.module.css';

interface User {
    id: number;
    name: string;
}

interface DeleteConfirmModalProps {
    user: User;
    onClose: () => void;
    onSuccess: () => void;
}

export default function DeleteConfirmModal({ user, onClose, onSuccess }: DeleteConfirmModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleDelete = async () => {
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`/api/users/${user.id}`, {
                method: 'DELETE',
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao excluir usuário');
            }

            onSuccess();
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Erro desconhecido');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>Excluir Usuário</h3>
                    <button onClick={onClose} className={styles.iconButton}>
                        <X size={20} />
                    </button>
                </div>
                <div className={styles.modalBody}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Tem certeza que deseja excluir o usuário <strong>{user.name}</strong>?
                    </p>
                    <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        Esta ação não pode ser desfeita.
                    </p>
                </div>

                {error && <div className={styles.modalBody} style={{ paddingTop: 0 }}><p style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</p></div>}

                <div className={styles.modalFooter} style={{ padding: '1.5rem' }}>
                    <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={styles.primaryButton}
                        style={{ backgroundColor: 'var(--danger)' }}
                        onClick={handleDelete}
                        disabled={loading}
                    >
                        {loading ? 'Excluindo...' : 'Excluir Usuário'}
                    </button>
                </div>
            </div>
        </div>
    );
}
