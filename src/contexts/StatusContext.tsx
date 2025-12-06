/**
 * Status Context - Provides dynamic status configuration throughout the app
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface StatusConfig {
    id: number;
    name: string;
    color: string;
    display_order: number;
}

interface StatusContextType {
    statuses: StatusConfig[];
    loading: boolean;
    getStatusColor: (statusName: string) => string;
    getStatusConfig: (statusName: string) => StatusConfig | undefined;
    refresh: () => void;
}

const StatusContext = createContext<StatusContextType | null>(null);

export function StatusProvider({ children }: { children: ReactNode }) {
    const [statuses, setStatuses] = useState<StatusConfig[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchStatuses = async () => {
        try {
            const res = await fetch('/api/statuses');
            const data = await res.json();
            setStatuses(data.data || []);
        } catch (error) {
            console.error('Error fetching statuses:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatuses();
    }, []);

    const getStatusColor = (statusName: string): string => {
        // Normalize for comparison (case-insensitive, trim)
        const normalized = statusName?.toLowerCase().trim();
        const found = statuses.find(s => s.name.toLowerCase().trim() === normalized);
        return found?.color || '#6b7280'; // Default gray
    };

    const getStatusConfig = (statusName: string): StatusConfig | undefined => {
        const normalized = statusName?.toLowerCase().trim();
        return statuses.find(s => s.name.toLowerCase().trim() === normalized);
    };

    return (
        <StatusContext.Provider value={{
            statuses,
            loading,
            getStatusColor,
            getStatusConfig,
            refresh: fetchStatuses
        }}>
            {children}
        </StatusContext.Provider>
    );
}

export function useStatuses() {
    const context = useContext(StatusContext);
    if (!context) {
        throw new Error('useStatuses must be used within a StatusProvider');
    }
    return context;
}
