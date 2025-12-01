import React from 'react';

interface TimeAgoBadgeProps {
    date: string | null | undefined;
}

export default function TimeAgoBadge({ date }: TimeAgoBadgeProps) {
    if (!date) {
        return (
            <span style={{
                backgroundColor: '#f1f5f9',
                color: '#64748b',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 500,
                whiteSpace: 'nowrap'
            }}>
                Nunca
            </span>
        );
    }

    const now = new Date();
    const msgDate = new Date(date);
    const diffMs = now.getTime() - msgDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let label = '';
    let color = '';
    let bg = '';

    // Fibonacci-like scale logic & Colors (Hot -> Cold)
    if (diffMinutes < 5) {
        label = 'Agora';
        color = '#dc2626'; // Red 600
        bg = '#fef2f2'; // Red 50
    } else if (diffMinutes < 60) {
        label = `${diffMinutes} min`;
        color = '#ea580c'; // Orange 600
        bg = '#fff7ed'; // Orange 50
    } else if (diffHours < 24) {
        label = `${diffHours}h`;
        color = '#d97706'; // Amber 600
        bg = '#fffbeb'; // Amber 50
    } else if (diffDays < 2) {
        label = 'Ontem';
        color = '#65a30d'; // Lime 600
        bg = '#f7fee7'; // Lime 50
    } else if (diffDays < 3) {
        label = '2 dias';
        color = '#16a34a'; // Green 600
        bg = '#f0fdf4'; // Green 50
    } else if (diffDays < 5) {
        label = `${diffDays} dias`;
        color = '#059669'; // Emerald 600
        bg = '#ecfdf5'; // Emerald 50
    } else if (diffDays < 8) {
        label = `${diffDays} dias`;
        color = '#0d9488'; // Teal 600
        bg = '#f0fdfa'; // Teal 50
    } else if (diffDays < 13) {
        label = `${diffDays} dias`;
        color = '#0891b2'; // Cyan 600
        bg = '#ecfeff'; // Cyan 50
    } else if (diffDays < 21) {
        label = `${diffDays} dias`;
        color = '#0284c7'; // Sky 600
        bg = '#f0f9ff'; // Sky 50
    } else {
        label = '+21 dias';
        color = '#475569'; // Slate 600
        bg = '#f8fafc'; // Slate 50
    }

    return (
        <span style={{
            backgroundColor: bg,
            color: color,
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            border: `1px solid ${color}20`
        }} title={msgDate.toLocaleString('pt-BR')}>
            {label}
        </span>
    );
}
