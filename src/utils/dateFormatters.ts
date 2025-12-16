/**
 * Date Formatting Utilities
 * 
 * Pure functions for formatting dates in different contexts.
 * Follows Single Responsibility Principle - each function does one thing well.
 * 
 * @module dateFormatters
 */

/**
 * Formats a date as time only (HH:mm)
 * @param date - Date string or Date object
 * @returns Formatted time string (e.g., "14:30")
 */
export function formatTimeOnly(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Formats a date as short date with time (DD/MM às HH:mm)
 * @param date - Date string or Date object
 * @returns Formatted string (e.g., "16/12 às 14:30")
 */
export function formatTimestamp(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const dateStr = d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
    });
    const timeStr = formatTimeOnly(d);
    return `${dateStr} às ${timeStr}`;
}

/**
 * Formats a date as full date and time
 * @param date - Date string or Date object
 * @returns Formatted string (e.g., "16 de dezembro de 2025 às 14:30")
 */
export function formatFullDateTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const dateStr = d.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    const timeStr = formatTimeOnly(d);
    return `${dateStr} às ${timeStr}`;
}

/**
 * Checks if a date is today
 * @param date - Date string or Date object
 * @returns True if date is today
 */
export function isToday(date: string | Date): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();

    return d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
}

/**
 * Checks if a date is yesterday
 * @param date - Date string or Date object
 * @returns True if date is yesterday
 */
export function isYesterday(date: string | Date): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear();
}

/**
 * Checks if a date is within the last 7 days
 * @param date - Date string or Date object
 * @returns True if date is within last week
 */
export function isThisWeek(date: string | Date): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return d >= weekAgo && d <= today;
}

/**
 * Gets the day of week in Portuguese
 * @param date - Date string or Date object
 * @returns Day name (e.g., "Seg", "Ter")
 */
export function getDayOfWeek(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('pt-BR', { weekday: 'short' });
}

/**
 * Formats a date for activity timeline display
 * Smart formatting based on recency:
 * - Today: "14:30"
 * - Yesterday: "Ontem às 14:30"
 * - This week: "Seg às 14:30"
 * - Older: "16/12 às 14:30"
 * 
 * @param date - Date string or Date object
 * @returns Formatted string optimized for timeline
 */
export function formatActivityTimestamp(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (isToday(d)) {
        return formatTimeOnly(d);
    }

    if (isYesterday(d)) {
        return `Ontem às ${formatTimeOnly(d)}`;
    }

    if (isThisWeek(d)) {
        return `${getDayOfWeek(d)} às ${formatTimeOnly(d)}`;
    }

    return formatTimestamp(d);
}

/**
 * Formats relative time (for backward compatibility with TimeAgoBadge)
 * @param date - Date string or Date object
 * @returns Relative time string (e.g., "há 2 horas")
 */
export function formatRelativeTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInMs = now.getTime() - d.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) {
        return 'agora';
    }

    if (diffInMinutes < 60) {
        return `há ${diffInMinutes} ${diffInMinutes === 1 ? 'minuto' : 'minutos'}`;
    }

    if (diffInHours < 24) {
        return `há ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
    }

    if (diffInDays < 7) {
        return `há ${diffInDays} ${diffInDays === 1 ? 'dia' : 'dias'}`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return `há ${diffInWeeks} ${diffInWeeks === 1 ? 'semana' : 'semanas'}`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    return `há ${diffInMonths} ${diffInMonths === 1 ? 'mês' : 'meses'}`;
}
