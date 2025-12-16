/**
 * TagFormModal Component
 * 
 * Modal for creating and editing tags.
 * Handles form state, validation, and API calls.
 * 
 * @example
 * <TagFormModal 
 *   isOpen={true}
 *   onClose={() => setOpen(false)}
 *   onSave={(tag) => handleSave(tag)}
 *   tag={existingTag} // optional, for editing
 * />
 */

'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ColorPicker } from './ColorPicker';
import { TagBadge } from './TagBadge';
import type { Tag, CreateTagDTO } from '@/types/tag';
import styles from './TagFormModal.module.css';

interface TagFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (tag: Tag) => void;
    tag?: Tag | null; // If editing
}

export function TagFormModal({ isOpen, onClose, onSave, tag }: TagFormModalProps) {
    const [name, setName] = useState('');
    const [color, setColor] = useState('#6b7280');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditing = !!tag;

    useEffect(() => {
        if (isOpen) {
            if (tag) {
                setName(tag.name);
                setColor(tag.color);
                setDescription(tag.description || '');
            } else {
                setName('');
                setColor('#6b7280');
                setDescription('');
            }
            setError(null);
        }
    }, [isOpen, tag]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError('Nome é obrigatório');
            return;
        }

        setSaving(true);

        try {
            const body: CreateTagDTO = {
                name: name.trim(),
                color,
                description: description.trim() || undefined,
            };

            const url = isEditing ? '/api/tags' : '/api/tags';
            const method = isEditing ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                    isEditing ? { id: tag.id, ...body } : body
                ),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Erro ao salvar tag');
            }

            const result = await response.json();

            // Call onSave with the tag
            const savedTag: Tag = isEditing
                ? { ...tag, ...body, updated_at: new Date().toISOString() }
                : {
                    id: result.id,
                    ...body,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    active: 1,
                };

            onSave(savedTag);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>{isEditing ? 'Editar Tag' : 'Nova Tag'}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className={styles.closeButton}
                        aria-label="Fechar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {error && (
                        <div className={styles.error} role="alert">
                            {error}
                        </div>
                    )}

                    <div className={styles.formGroup}>
                        <label htmlFor="tagName" className={styles.label}>
                            Nome *
                        </label>
                        <input
                            id="tagName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={50}
                            placeholder="Ex: VIP, Urgente, Follow-up"
                            className={styles.input}
                            autoFocus
                        />
                        <span className={styles.hint}>
                            {name.length}/50 caracteres
                        </span>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Cor *</label>
                        <ColorPicker value={color} onChange={setColor} />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="tagDescription" className={styles.label}>
                            Descrição (opcional)
                        </label>
                        <textarea
                            id="tagDescription"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Descreva quando usar esta tag..."
                            rows={3}
                            className={styles.textarea}
                        />
                    </div>

                    <div className={styles.preview}>
                        <span className={styles.previewLabel}>Preview:</span>
                        <TagBadge
                            tag={{ name: name || 'Tag', color }}
                            size="md"
                        />
                    </div>

                    <div className={styles.actions}>
                        <button
                            type="button"
                            onClick={onClose}
                            className={styles.cancelButton}
                            disabled={saving}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={styles.saveButton}
                            disabled={saving || !name.trim()}
                        >
                            {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Tag'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
