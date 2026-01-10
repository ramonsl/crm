'use client';

import { Pencil, Trash2, Key } from 'lucide-react';
import styles from '@/app/usuarios/Users.module.css';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    active: boolean;
    created_at?: string;
}

interface UserTableProps {
    users: User[];
    loading: boolean;
    onEdit: (user: User) => void;
    onChangePassword: (user: User) => void;
    onDelete: (user: User) => void;
}

export default function UserTable({
    users,
    loading,
    onEdit,
    onChangePassword,
    onDelete,
}: UserTableProps) {
    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando usuários...</div>;
    }

    if (users.length === 0) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum usuário encontrado.</div>;
    }

    return (
        <div className={styles.tableContainer}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>Função</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <tr key={user.id}>
                            <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>{user.name}</td>
                            <td>{user.email}</td>
                            <td>
                                <span className={`${styles.badge} ${user.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}`}>
                                    {user.role === 'admin' ? 'Admin' : 'Usuário'}
                                </span>
                            </td>
                            <td>
                                <span className={`${styles.badge} ${user.active ? styles.badgeActive : styles.badgeInactive}`}>
                                    {user.active ? 'Ativo' : 'Inativo'}
                                </span>
                            </td>
                            <td>
                                <div className={styles.actions}>
                                    <button
                                        className={styles.iconButton}
                                        onClick={() => onEdit(user)}
                                        title="Editar"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        className={styles.iconButton}
                                        onClick={() => onChangePassword(user)}
                                        title="Alterar Senha"
                                    >
                                        <Key size={16} />
                                    </button>
                                    <button
                                        className={`${styles.iconButton} ${styles.deleteButton}`}
                                        onClick={() => onDelete(user)}
                                        title="Excluir"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
