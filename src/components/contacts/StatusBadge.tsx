/**
 * StatusBadge - Display contact status with dynamic color coding
 */

'use client';

import { useStatuses } from '@/contexts/StatusContext';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
    status: string;
    className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
    const { getStatusColor } = useStatuses();
    const color = getStatusColor(status);

    // Calculate contrasting text color (white or black based on bg luminance)
    const getContrastColor = (hexColor: string): string => {
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    };

    return (
        <span
            className={`${styles.badge} ${className}`}
            style={{
                backgroundColor: `${color}20`,
                color: color,
                borderColor: `${color}40`
            }}
            title={status}
        >
            {status}
        </span>
    );
}
