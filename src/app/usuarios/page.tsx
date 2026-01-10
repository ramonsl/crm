'use client';

import { useState, useEffect } from 'react';
import UserTable from '@/components/users/UserTable';
import CreateUserModal from '@/components/users/CreateUserModal';
import EditUserModal from '@/components/users/EditUserModal';
import ChangePasswordModal from '@/components/users/ChangePasswordModal';
import DeleteConfirmModal from '@/components/users/DeleteConfirmModal';
import { Plus } from 'lucide-react';
import styles from '@/app/usuarios/Users.module.css';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    active: boolean;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [changingPasswordUser, setChangingPasswordUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/users');
            const data = await res.json();
            if (data.success) {
                setUsers(data.data);
            } else {
                console.error('Failed to fetch users:', data.error);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h2>Gerenciamento de Usuários</h2>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.primaryButton} onClick={() => setShowCreateModal(true)}>
                        <Plus size={18} />
                        Novo Usuário
                    </button>
                </div>
            </div>

            <UserTable
                users={users}
                loading={loading}
                onEdit={setEditingUser}
                onChangePassword={setChangingPasswordUser}
                onDelete={setDeletingUser}
            />

            {showCreateModal && (
                <CreateUserModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        setShowCreateModal(false);
                        fetchUsers();
                    }}
                />
            )}

            {editingUser && (
                <EditUserModal
                    user={editingUser}
                    onClose={() => setEditingUser(null)}
                    onSuccess={() => {
                        setEditingUser(null);
                        fetchUsers();
                    }}
                />
            )}

            {changingPasswordUser && (
                <ChangePasswordModal
                    user={changingPasswordUser}
                    onClose={() => setChangingPasswordUser(null)}
                    onSuccess={() => setChangingPasswordUser(null)}
                />
            )}

            {deletingUser && (
                <DeleteConfirmModal
                    user={deletingUser}
                    onClose={() => setDeletingUser(null)}
                    onSuccess={() => {
                        setDeletingUser(null);
                        fetchUsers();
                    }}
                />
            )}
        </div>
    );
}
