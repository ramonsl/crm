/**
 * StatusBadge - Display contact status with color coding
 */

'use client';

import { STATUS_CONFIG } from '@/types/contacts';
import type { ContactStatus } from '@/types/contacts';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
    status: ContactStatus;
    className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
    const config = STATUS_CONFIG[status] || { color: 'gray', label: status };

    return (
        <span
            className={`${styles.badge} ${styles[config.color]} ${className}`}
            title={config.label}
        >
            {config.label}
        </span>
    );
}
