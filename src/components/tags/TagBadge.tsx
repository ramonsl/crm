/**
 * TagBadge Component
 * 
 * Visual badge display for a tag with color and optional remove button.
 * Single responsibility: Display a tag visually.
 * 
 * @example
 * <TagBadge tag={{ name: "VIP", color: "#ef4444" }} />
 * <TagBadge tag={tag} onRemove={() => handleRemove()} size="sm" />
 */

'use client';

import { X } from 'lucide-react';
import type { Tag } from '@/types/tag';
import styles from './TagBadge.module.css';

interface TagBadgeProps {
    tag: Tag | { id?: number; name: string; color: string };
    onRemove?: () => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function TagBadge({
    tag,
    onRemove,
    size = 'md',
    className = ''
}: TagBadgeProps) {
    const sizeClass = {
        sm: styles.badgeSm,
        md: styles.badgeMd,
        lg: styles.badgeLg,
    }[size];

    return (
        <span
            className={`${styles.badge} ${sizeClass} ${className}`}
            style={{
                backgroundColor: `${tag.color}20`,
                borderColor: tag.color,
                color: tag.color
            }}
            title={tag.name}
        >
            <span className={styles.name}>{tag.name}</span>
            {onRemove && (
                <button
                    type="button"
                    className={styles.removeButton}
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    aria-label={`Remover tag ${tag.name}`}
                >
                    <X size={size === 'sm' ? 12 : 14} />
                </button>
            )}
        </span>
    );
}
