'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { Plus, Edit2, Trash2, X, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [formData, setFormData] = useState({ name: '', message: '', type: 'fixed' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/api/templates');
            const data = await res.json();
            setTemplates(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (template?: Template) => {
        if (template) {
            setEditingTemplate(template);
            setFormData({ name: template.name, message: template.message, type: template.type || 'fixed' });
        } else {
            setEditingTemplate(null);
            setFormData({ name: '', message: '', type: 'fixed' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTemplate(null);
        setFormData({ name: '', message: '', type: 'fixed' });
    };

    const handleSave = async () => {
        if (!formData.name || !formData.message) return;

        setSaving(true);
        try {
            const method = editingTemplate ? 'PUT' : 'POST';
            const body = editingTemplate ? { ...formData, id: editingTemplate.id } : formData;

            const res = await fetch('/api/templates', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                fetchTemplates();
                handleCloseModal();
                toastSuccess('Modelo salvo com sucesso!');
            } else {
                toastError('Erro ao salvar modelo.');
            }
        } catch (error) {
            console.error(error);
            toastError('Erro ao salvar.');
        } finally {
            setSaving(false);
        }
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
                await fetchTemplates(); // Force refetch
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

    if (loading) {
        return (
            <div className={styles.container}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                    <Loader2 className={styles.spin} size={32} />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Modelos de Mensagem</h1>
                    <p className={styles.subtitle}>Gerencie os textos padrões para envio rápido</p>
                </div>
                <button className={styles.addButton} onClick={() => handleOpenModal()}>
                    <Plus size={20} />
                    Novo Modelo
                </button>
            </header>

            <div className={styles.grid}>
                {templates.map((template) => (
                    <div key={template.id} className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileText size={18} color={template.type === 'ai' ? '#8b5cf6' : '#64748b'} />
                                <div>
                                    <h3 className={styles.cardTitle}>{template.name}</h3>
                                    {template.type === 'ai' && (
                                        <span style={{ fontSize: '0.7rem', backgroundColor: '#8b5cf6', color: 'white', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>IA</span>
                                    )}
                                </div>
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
                        <p className={styles.cardContent}>{template.message}</p>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3>{editingTemplate ? 'Editar Modelo' : 'Novo Modelo'}</h3>
                            <button onClick={handleCloseModal} className={styles.closeButton}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.inputGroup}>
                                <label>Tipo de Modelo</label>
                                <select
                                    className={styles.input}
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="fixed">Mensagem Fixa</option>
                                    <option value="ai">Mensagem com IA</option>
                                </select>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Nome do Modelo</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Ex: Boas-vindas"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>{formData.type === 'ai' ? 'Prompt para a IA' : 'Mensagem'}</label>
                                <textarea
                                    className={styles.textarea}
                                    placeholder={formData.type === 'ai' ?
                                        "Ex: Crie uma mensagem de boas-vindas amigável para {nome}..." :
                                        "Ex: Olá {nome}, tudo bem?"}
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                />
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                                    Dica: Use <strong>{'{nome}'}</strong> (primeiro nome), <strong>{'{nome_completo}'}</strong>, <strong>{'{curso}'}</strong> ou <strong>{'{escola}'}</strong> para personalizar.
                                </p>
                            </div>
                            <div className={styles.modalFooter}>
                                <button className={styles.secondaryButton} onClick={handleCloseModal}>
                                    Cancelar
                                </button>
                                <button
                                    className={styles.primaryButton}
                                    onClick={handleSave}
                                    disabled={saving || !formData.name || !formData.message}
                                >
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
