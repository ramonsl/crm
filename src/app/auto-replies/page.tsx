'use client';

/**
 * Auto-Replies Management Page
 * Main page for configuring and managing automated responses
 * Following system UI/UX patterns
 */

import { useState, useEffect } from 'react';
import { AutoReplyList } from '@/components/auto-replies/AutoReplyList';
import { AutoReplyForm } from '@/components/auto-replies/AutoReplyForm';
import { AutoReplyTester } from '@/components/auto-replies/AutoReplyTester';
import { AutoReplyStats } from '@/components/auto-replies/AutoReplyStats';
import type { AutoReply } from '@/types/autoReply';
import { useToast } from '@/contexts/ToastContext';
import { Plus, RefreshCw } from 'lucide-react';
import styles from '@/components/auto-replies/AutoReplies.module.css';

export default function AutoRepliesPage() {
    const { success, error: toastError } = useToast();
    const [replies, setReplies] = useState<AutoReply[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingReply, setEditingReply] = useState<AutoReply | null>(null);
    const [activeTab, setActiveTab] = useState<'list' | 'test' | 'stats'>('list');

    useEffect(() => {
        loadReplies();
    }, []);

    const loadReplies = async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/auto-replies');
            if (res.ok) {
                const data = await res.json();
                setReplies(data);
            } else {
                toastError('Erro ao carregar respostas automáticas');
            }
        } catch (error) {
            console.error('Error loading auto-replies:', error);
            toastError('Erro ao carregar respostas automáticas');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingReply(null);
        setIsFormOpen(true);
    };

    const handleEdit = (reply: AutoReply) => {
        setEditingReply(reply);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja deletar esta resposta automática?')) {
            return;
        }

        try {
            const res = await fetch(`/api/auto-replies/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                success('Resposta automática deletada com sucesso!');
                loadReplies();
            } else {
                const errorData = await res.json();
                toastError(`Erro ao deletar: ${errorData.error || 'Erro desconhecido'}`);
            }
        } catch (error) {
            console.error('Error deleting auto-reply:', error);
            toastError('Erro ao deletar resposta automática');
        }
    };

    const handleToggle = async (id: number) => {
        try {
            const res = await fetch(`/api/auto-replies/${id}/toggle`, {
                method: 'POST',
            });
            if (res.ok) {
                success('Status atualizado!');
                loadReplies();
            } else {
                const errorData = await res.json();
                toastError(`Erro ao atualizar: ${errorData.error || 'Erro desconhecido'}`);
            }
        } catch (error) {
            console.error('Error toggling auto-reply:', error);
            toastError('Erro ao atualizar status');
        }
    };

    const handleFormClose = () => {
        setIsFormOpen(false);
        setEditingReply(null);
        loadReplies();
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h2>Respostas Automáticas</h2>
                </div>
                <div className={styles.headerActions}>
                    <button onClick={handleCreate} className={styles.primaryButton}>
                        <Plus size={18} />
                        Nova Resposta
                    </button>
                    <button onClick={loadReplies} className={styles.iconButton} title="Atualizar">
                        <RefreshCw size={18} className={isLoading ? styles.spinning : ''} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`${styles.tab} ${activeTab === 'list' ? styles.tabActive : ''}`}
                >
                    Gerenciar ({replies.length})
                </button>
                <button
                    onClick={() => setActiveTab('test')}
                    className={`${styles.tab} ${activeTab === 'test' ? styles.tabActive : ''}`}
                >
                    Testar
                </button>
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`${styles.tab} ${activeTab === 'stats' ? styles.tabActive : ''}`}
                >
                    Estatísticas
                </button>
            </div>

            {/* Content */}
            {activeTab === 'list' && (
                <AutoReplyList
                    replies={replies}
                    loading={isLoading}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                />
            )}

            {activeTab === 'test' && <AutoReplyTester />}

            {activeTab === 'stats' && <AutoReplyStats />}

            {/* Form Modal */}
            {isFormOpen && (
                <AutoReplyForm
                    reply={editingReply}
                    onClose={handleFormClose}
                />
            )}
        </div>
    );
}
