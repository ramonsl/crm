import { getErrorMessage } from '@/lib/types';

/**
 * Hook for managing templates
 */

import { useState, useEffect } from 'react';

interface Template {
    id: number;
    name: string;
    message: string;
    type: 'fixed' | 'ai';
}

export function useTemplates() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTemplates = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/templates');
            if (!res.ok) throw new Error('Failed to fetch templates');
            const data = await res.json();
            setTemplates(data);
        } catch (err) {
            setError(err instanceof Error ? getErrorMessage(err) : 'Unknown error');
            console.error('Error fetching templates:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    return {
        templates,
        loading,
        error,
        refresh: fetchTemplates
    };
}
