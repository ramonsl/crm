/**
 * TagSelector Component
 * 
 * Multi-select dropdown for selecting and associating tags to a lead.
 * Can create new tags inline.
 * 
 * @example
 * <TagSelector
 *   leadCpf="12345678900"
 *   selectedTags={tags}
 *   onTagsChange={(newTags) => setTags(newTags)}
 * />
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { TagBadge } from './TagBadge';
import { TagFormModal } from './TagFormModal';
import type { Tag } from '@/types/tag';
import styles from './TagSelector.module.css';

interface TagSelectorProps {
    leadCpf: string;
    selectedTags: Tag[];
    onTagsChange: (tags: Tag[]) => void;
    inline?: boolean;
}

export function TagSelector({
    leadCpf,
    selectedTags,
    onTagsChange,
    inline = false
}: TagSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load available tags
    useEffect(() => {
        if (isOpen) {
            loadTags();
        }
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const loadTags = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/tags');
            if (response.ok) {
                const data = await response.json();
                setAvailableTags(data.data || []);
            }
        } catch (error) {
            console.error('Error loading tags:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTag = async (tag: Tag) => {
        const isSelected = selectedTags.some(t => t.id === tag.id);

        if (isSelected) {
            // Remove tag
            try {
                const response = await fetch(`/api/leads/${leadCpf}/tags/${tag.id}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    onTagsChange(selectedTags.filter(t => t.id !== tag.id));
                }
            } catch (error) {
                console.error('Error removing tag:', error);
            }
        } else {
            // Add tag
            try {
                const response = await fetch(`/api/leads/${leadCpf}/tags`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tagId: tag.id }),
                });

                if (response.ok) {
                    onTagsChange([...selectedTags, tag]);
                }
            } catch (error) {
                console.error('Error adding tag:', error);
            }
        }
    };

    const handleCreateTag = (newTag: Tag) => {
        setAvailableTags([...availableTags, newTag]);
        setShowCreateModal(false);
        // Auto-select the new tag
        handleToggleTag(newTag);
    };

    const filteredTags = availableTags.filter(tag =>
        tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={styles.container} ref={dropdownRef}>
            {/* Display selected tags */}
            <div className={styles.selectedTags} onClick={() => setIsOpen(!isOpen)}>
                {selectedTags.length === 0 ? (
                    <span className={styles.placeholder}>Selecionar tags...</span>
                ) : (
                    <>
                        {selectedTags.slice(0, 2).map(tag => (
                            <TagBadge
                                key={tag.id}
                                tag={tag}
                                size="sm"
                                onRemove={(e) => {
                                    e?.stopPropagation();
                                    handleToggleTag(tag);
                                }}
                            />
                        ))}
                        {selectedTags.length > 2 && (
                            <span className={styles.moreCount}>
                                +{selectedTags.length - 2}
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className={styles.dropdown}>
                    <div className={styles.searchSection}>
                        <div className={styles.searchInput}>
                            <Search size={16} className={styles.searchIcon} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar tags..."
                                className={styles.input}
                                autoFocus
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className={styles.clearButton}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className={styles.createButton}
                            title="Criar nova tag"
                        >
                            <Plus size={16} />
                            Nova
                        </button>
                    </div>

                    <div className={styles.tagList}>
                        {loading ? (
                            <div className={styles.loading}>Carregando...</div>
                        ) : filteredTags.length === 0 ? (
                            <div className={styles.empty}>
                                {searchTerm ? 'Nenhuma tag encontrada' : 'Nenhuma tag disponível'}
                            </div>
                        ) : (
                            filteredTags.map(tag => {
                                const isSelected = selectedTags.some(t => t.id === tag.id);
                                return (
                                    <label
                                        key={tag.id}
                                        className={`${styles.tagItem} ${isSelected ? styles.selected : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleTag(tag)}
                                            className={styles.checkbox}
                                        />
                                        <TagBadge tag={tag} size="sm" />
                                    </label>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Create Tag Modal */}
            <TagFormModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSave={handleCreateTag}
            />
        </div>
    );
}
