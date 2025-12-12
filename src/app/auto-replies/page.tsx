'use client';

/**
 * Auto-Replies Management Page
 * Main page for configuring and managing automated responses
 */

import { useState, useEffect } from 'react';
import { AutoReplyList } from '@/components/auto-replies/AutoReplyList';
import { AutoReplyForm } from '@/components/auto-replies/AutoReplyForm';
import { AutoReplyTester } from '@/components/auto-replies/AutoReplyTester';
import { AutoReplyStats } from '@/components/auto-replies/AutoReplyStats';
import type { AutoReply } from '@/types/autoReply';

export default function AutoRepliesPage() {
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
            }
        } catch (error) {
            console.error('Error loading auto-replies:', error);
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
                loadReplies();
            }
        } catch (error) {
            console.error('Error deleting auto-reply:', error);
        }
    };

    const handleToggle = async (id: number) => {
        try {
            const res = await fetch(`/api/auto-replies/${id}/toggle`, {
                method: 'POST',
            });
            if (res.ok) {
                loadReplies();
            }
        } catch (error) {
            console.error('Error toggling auto-reply:', error);
        }
    };

    const handleFormClose = () => {
        setIsFormOpen(false);
        setEditingReply(null);
        loadReplies();
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Respostas Automáticas
                    </h1>
                    <p className="mt-2 text-gray-600">
                        Configure respostas automáticas inteligentes com detecção de intenção via IA
                    </p>
                </div>

                {/* Tabs */}
                <div className="mb-6 border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'list'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Gerenciar ({replies.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('test')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'test'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Testar
                        </button>
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'stats'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Estatísticas
                        </button>
                    </nav>
                </div>

                {/* Content */}
                {activeTab === 'list' && (
                    <div>
                        <div className="mb-4 flex justify-end">
                            <button
                                onClick={handleCreate}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                + Nova Resposta Automática
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="text-center py-12">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
                                <p className="mt-2 text-gray-600">Carregando...</p>
                            </div>
                        ) : (
                            <AutoReplyList
                                replies={replies}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onToggle={handleToggle}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'test' && (
                    <AutoReplyTester />
                )}

                {activeTab === 'stats' && (
                    <AutoReplyStats />
                )}

                {/* Form Modal */}
                {isFormOpen && (
                    <AutoReplyForm
                        reply={editingReply}
                        onClose={handleFormClose}
                    />
                )}
            </div>
        </div>
    );
}
