/**
 * StatusBadge - Display contact status with dynamic color coding
 * Shows additional badges for recent status changes and frozen statuses
 */

'use client';

import { useStatuses } from '@/contexts/StatusContext';
import { Flame, Snowflake } from 'lucide-react';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
    status: string;
    status_changed_at?: string;
    className?: string;
}

export function StatusBadge({ status, status_changed_at, className = '' }: StatusBadgeProps) {
    const { getStatusColor } = useStatuses();
    const color = getStatusColor(status);

    // Calculate badge type based on status_changed_at
    const getStatusBadgeType = (): 'recent' | 'frozen' | null => {
        if (!status_changed_at) return null;

        const now = new Date();
        const changedAt = new Date(status_changed_at);
        const hoursDiff = (now.getTime() - changedAt.getTime()) / (1000 * 60 * 60);

        if (hoursDiff <= 72) {
            return 'recent'; // Changed in last 72 hours
        }

        if (hoursDiff >= 168) { // 7 days = 168 hours
            return 'frozen'; // Not changed for 7+ days
        }

        return null;
    };

    const badgeType = getStatusBadgeType();

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

            {badgeType === 'recent' && (
                <span
                    className={styles.statusIndicator}
                    style={{
                        backgroundColor: '#ff6b35',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                    }}
                    title="Status alterado nas últimas 72 horas"
                >
                    <Flame size={12} />
                    Recente
                </span>
            )}

            {badgeType === 'frozen' && (
                <span
                    className={styles.statusIndicator}
                    style={{
                        backgroundColor: '#4a90e2',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                    }}
                    title="Status não muda há 7+ dias"
                >
                    <Snowflake size={12} />
                    Congelado
                </span>
            )}
        </div>
    );
}
