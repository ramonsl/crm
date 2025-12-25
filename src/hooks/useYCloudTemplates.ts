/**
 * useYCloudTemplates Hook
 * 
 * React hook for managing YCloud templates.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { YCloudTemplateRow } from '@/lib/repositories/YCloudTemplateRepository';

interface UseYCloudTemplatesReturn {
    templates: YCloudTemplateRow[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createDraft: (data: CreateTemplateData) => Promise<{ success: boolean; error?: string; data?: YCloudTemplateRow }>;
    updateDraft: (id: number, data: Partial<CreateTemplateData>) => Promise<{ success: boolean; error?: string }>;
    submitForApproval: (id: number) => Promise<{ success: boolean; error?: string }>;
    syncStatuses: () => Promise<{ success: boolean; updated?: number; errors?: number; error?: string }>;
    deleteTemplate: (id: number) => Promise<{ success: boolean; error?: string }>;
}

interface CreateTemplateData {
    template_name: string;
    friendly_name: string;
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    body_text: string;
    language?: string;
    header_type?: string;
    header_content?: string;
    footer_text?: string;
    variables?: Array<{ position: number; sample: string; field: string }>;
}

export function useYCloudTemplates(): UseYCloudTemplatesReturn {
    const [templates, setTemplates] = useState<YCloudTemplateRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/ycloud-templates');
            if (!res.ok) {
                throw new Error('Failed to fetch templates');
            }
            const data = await res.json();
            setTemplates(data.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const createDraft = async (data: CreateTemplateData) => {
        try {
            const res = await fetch('/api/ycloud-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (!res.ok) {
                return { success: false, error: result.error || 'Failed to create template' };
            }

            await refresh();
            return { success: true, data: result.data };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    const updateDraft = async (id: number, data: Partial<CreateTemplateData>) => {
        try {
            const res = await fetch(`/api/ycloud-templates/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (!res.ok) {
                return { success: false, error: result.error || 'Failed to update template' };
            }

            await refresh();
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    const submitForApproval = async (id: number) => {
        try {
            const res = await fetch(`/api/ycloud-templates/${id}/submit`, {
                method: 'POST'
            });

            const result = await res.json();

            if (!res.ok) {
                return { success: false, error: result.error || 'Failed to submit template' };
            }

            await refresh();
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    const syncStatuses = async () => {
        try {
            const res = await fetch('/api/ycloud-templates/sync', {
                method: 'POST'
            });

            const result = await res.json();

            if (!res.ok) {
                return { success: false, error: result.error || 'Failed to sync templates' };
            }

            await refresh();
            return { success: true, updated: result.updated, errors: result.errors };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    const deleteTemplate = async (id: number) => {
        try {
            const res = await fetch(`/api/ycloud-templates/${id}`, {
                method: 'DELETE'
            });

            const result = await res.json();

            if (!res.ok) {
                return { success: false, error: result.error || 'Failed to delete template' };
            }

            await refresh();
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    return {
        templates,
        loading,
        error,
        refresh,
        createDraft,
        updateDraft,
        submitForApproval,
        syncStatuses,
        deleteTemplate
    };
}
