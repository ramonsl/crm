/**
 * Tags Management Page
 * 
 * CRUD interface for managing tags.
 * Lists all tags with usage count, allows create/edit/delete.
 * 
 * Route: /settings/tags
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Tag as TagIcon } from 'lucide-react';
import { TagBadge } from '@/components/tags/TagBadge';
import { TagFormModal } from '@/components/tags/TagFormModal';
import type { Tag, TagWithUsage } from '@/types/tag';
import styles from './page.module.css';

export default function TagsManagementPage() {
    const [tags, setTags] = useState<TagWithUsage[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [deletingTagId, setDeletingTagId] = useState<number | null>(null);

    useEffect(() => {
        loadTags();
    }, []);

    const loadTags = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/tags');
            if (response.ok) {
                const data = await response.json();
                setTags(data.data || []);
            }
        } catch (error) {
            console.error('Error loading tags:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        setEditingTag(null);
        setIsFormOpen(true);
    };

    const handleEdit = (tag: Tag) => {
        setEditingTag(tag);
        setIsFormOpen(true);
    };

    const handleSaveTag = (tag: Tag) => {
        loadTags(); // Reload to get fresh data
    };

    const handleDelete = async (tagId: number) => {
        if (!confirm('Tem certeza que deseja excluir esta tag? Esta ação não pode ser desfeita.')) {
            return;
        }

        setDeletingTagId(tagId);
        try {
            const response = await fetch(`/api/tags?id=${tagId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setTags(tags.filter(t => t.id !== tagId));
            } else {
                alert('Erro ao excluir tag');
            }
        } catch (error) {
            console.error('Error deleting tag:', error);
            alert('Erro ao excluir tag');
        } finally {
            setDeletingTagId(null);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        <TagIcon size={28} />
                        Gerenciar Tags
                    </h1>
                    <p className={styles.subtitle}>
                        Crie e organize tags para categorizar seus leads
                    </p>
                </div>
                <button
                    className={styles.createButton}
                    onClick={handleCreateNew}
                >
                    <Plus size={20} />
                    Nova Tag
                </button>
            </div>

            {loading ? (
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    Carregando tags...
                </div>
            ) : tags.length === 0 ? (
                <div className={styles.empty}>
                    <TagIcon size={48} className={styles.emptyIcon} />
                    <h3>Nenhuma tag criada</h3>
                    <p>Crie sua primeira tag para começar a organizar seus leads</p>
                    <button
                        className={styles.createButton}
                        onClick={handleCreateNew}
                    >
                        <Plus size={20} />
                        Criar Primeira Tag
                    </button>
                </div>
            ) : (
                <div className={styles.grid}>
                    {tags.map((tag) => (
                        <div key={tag.id} className={styles.card}>
                            <div className={styles.cardHeader}>
                                <TagBadge tag={tag} size="md" />
                                <div className={styles.cardActions}>
                                    <button
                                        className={styles.iconButton}
                                        onClick={() => handleEdit(tag)}
                                        title="Editar tag"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        className={`${styles.iconButton} ${styles.deleteButton}`}
                                        onClick={() => handleDelete(tag.id)}
                                        disabled={deletingTagId === tag.id}
                                        title="Excluir tag"
                                    >
                                        {deletingTagId === tag.id ? (
                                            <div className={styles.miniSpinner} />
                                        ) : (
                                            <Trash2 size={16} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {tag.description && (
                                <p className={styles.description}>{tag.description}</p>
                            )}

                            <div className={styles.cardFooter}>
                                <span className={styles.usageCount}>
                                    {tag.usage_count} {tag.usage_count === 1 ? 'lead' : 'leads'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <TagFormModal
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false);
                    setEditingTag(null);
                }}
                onSave={handleSaveTag}
                tag={editingTag}
            />
        </div>
    );
}
