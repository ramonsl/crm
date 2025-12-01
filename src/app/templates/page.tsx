'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { Plus, Edit2, Trash2, X, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface Template {
    id: number;
    title: string;
    content: string;
    type?: string;
}

export default function TemplatesPage() {
    const { success: toastSuccess, error: toastError } = useToast();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [formData, setFormData] = useState({ title: '', content: '', type: 'fixed' });
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
            setFormData({ title: template.title, content: template.content, type: template.type || 'fixed' });
        } else {
            setEditingTemplate(null);
            setFormData({ title: '', content: '', type: 'fixed' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTemplate(null);
        setFormData({ title: '', content: '', type: 'fixed' });
    };

    const handleSave = async () => {
        if (!formData.title || !formData.content) return;

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
        if (!confirm('Tem certeza que deseja excluir este modelo?')) return;

        try {
            const res = await fetch(`/api/templates?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchTemplates();
                toastSuccess('Modelo excluído com sucesso!');
            } else {
                toastError('Erro ao excluir.');
            }
        } catch (error) {
            console.error(error);
            toastError('Erro ao excluir.');
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
                                <FileText size={18} color={template.type === 'ai_prompt' ? '#8b5cf6' : '#64748b'} />
                                <div>
                                    <h3 className={styles.cardTitle}>{template.title}</h3>
                                    {template.type === 'ai_prompt' && (
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
                        <p className={styles.cardContent}>{template.content}</p>
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
                                    <option value="ai_prompt">Prompt de IA</option>
                                </select>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Título</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Ex: Boas-vindas"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>{formData.type === 'ai_prompt' ? 'Prompt para a IA' : 'Conteúdo da Mensagem'}</label>
                                <textarea
                                    className={styles.textarea}
                                    placeholder={formData.type === 'ai_prompt' ?
                                        "Ex: Crie uma mensagem de boas-vindas amigável para {nome}..." :
                                        "Ex: Olá {nome}, tudo bem?"}
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                />
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                                    Dica: Use <strong>{'{nome}'}</strong> para inserir o nome do contato automaticamente.
                                </p>
                            </div>
                            <div className={styles.modalFooter}>
                                <button className={styles.secondaryButton} onClick={handleCloseModal}>
                                    Cancelar
                                </button>
                                <button
                                    className={styles.primaryButton}
                                    onClick={handleSave}
                                    disabled={saving || !formData.title || !formData.content}
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
