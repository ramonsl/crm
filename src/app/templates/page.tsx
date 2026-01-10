'use client';

import { useState, useEffect } from 'react';
import TemplateModal from '@/components/templates/TemplateModal';
import { Plus, Edit2, Trash2, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import styles from '@/components/templates/Templates.module.css';

interface Template {
    id: number;
    name: string;
    message: string;
    type?: string;
}

export default function TemplatesPage() {
    const { success: toastSuccess, error: toastError } = useToast();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/templates');
            const data = await res.json();
            setTemplates(data);
        } catch (error) {
            console.error(error);
            toastError('Erro ao carregar modelos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleOpenModal = (template?: Template) => {
        setEditingTemplate(template || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTemplate(null);
    };

    const handleSuccess = () => {
        handleCloseModal();
        fetchTemplates();
        toastSuccess('Modelo salvo com sucesso!');
    };

    const handleDelete = async (id: number) => {
        const templateName = templates.find(t => t.id === id)?.name;

        if (!window.confirm(`Tem certeza que deseja excluir o modelo "${templateName}"?\n\nEsta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/templates?id=${id}`, {
                method: 'DELETE'
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toastSuccess(`Modelo "${templateName}" excluído com sucesso!`);
                await fetchTemplates();
            } else {
                const errorMsg = data.error || 'Erro ao excluir modelo.';
                toastError(errorMsg);
                console.error('Delete failed:', data);
            }
        } catch (error) {
            console.error('Delete error:', error);
            toastError('Erro de conexão ao excluir modelo.');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h2>Modelos de Mensagem</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Gerencie os textos padrões para envio rápido.
                    </p>
                </div>
                <button className={styles.primaryButton} onClick={() => handleOpenModal()}>
                    <Plus size={18} /> Novo Modelo
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <Loader2 className={styles.spin} size={32} />
                </div>
            ) : (
                <div className={styles.grid}>
                    {templates.map((template) => (
                        <div key={template.id} className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FileText size={18} color={template.type === 'ai' ? '#8b5cf6' : '#64748b'} />
                                    <h3 className={styles.cardTitle}>{template.name}</h3>
                                    {template.type === 'ai' && (
                                        <span className={styles.badge}>IA</span>
                                    )}
                                </div>
                            </div>
                            <div className={styles.cardContent}>
                                {template.message}
                            </div>
                            <div className={styles.cardActions}>
                                <button
                                    className={styles.iconButton}
                                    onClick={() => handleOpenModal(template)}
                                    title="Editar"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    className={`${styles.iconButton} ${styles.deleteButton}`}
                                    onClick={() => handleDelete(template.id)}
                                    title="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <TemplateModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSuccess={handleSuccess}
                template={editingTemplate}
            />
        </div>
    );
}
