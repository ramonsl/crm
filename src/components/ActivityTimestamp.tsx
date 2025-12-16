/**
 * ActivityTimestamp Component
 * 
 * Displays timestamp for timeline activities with smart formatting.
 * Shows concise format by default with full details on hover.
 * 
 * Follows:
 * - Single Responsibility: Only displays timestamps
 * - Open/Closed: Extensible via props without modification
 * - Dependency Inversion: Depends on dateFormatters abstraction
 */

'use client';

import { formatActivityTimestamp, formatFullDateTime } from '@/utils/dateFormatters';
import styles from './ActivityTimestamp.module.css';

interface ActivityTimestampProps {
    /** ISO date string or Date object */
    date: string | Date;
    /** Optional CSS class for custom styling */
    className?: string;
    /** Show full date format instead of smart format */
    showFullDate?: boolean;
}

/**
 * ActivityTimestamp - Smart timestamp display for activity timeline
 * 
 * @example
 * <ActivityTimestamp date="2025-12-16T14:30:00" />
 * // Renders: "14:30" (if today) with tooltip showing full date
 */
export function ActivityTimestamp({
    date,
    className = '',
    showFullDate = false
}: ActivityTimestampProps) {
    const displayText = showFullDate
        ? formatFullDateTime(date)
        : formatActivityTimestamp(date);

    const tooltipText = formatFullDateTime(date);

    return (
        <time
            className={`${styles.timestamp} ${className}`}
            dateTime={typeof date === 'string' ? date : date.toISOString()}
            title={tooltipText}
        >
            {displayText}
        </time>
    );
}
