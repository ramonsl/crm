import { getErrorMessage } from '@/lib/types';

/**
 * Hook for managing contacts data and state
 */

import { useState, useEffect, useCallback } from 'react';
import type { Contact, ContactsFilters, ContactView } from '@/types/contacts';
import { VIEW_FILTERS } from '@/types/contacts';

interface UseContactsResult {
    contacts: Contact[];
    loading: boolean;
    error: string | null;
    totalPages: number;
    totalCount: number;
    currentPage: number;
    refresh: () => void;
}

export function useContacts(
    view: ContactView = 'all',
    initialFilters: Partial<ContactsFilters> = {}
): UseContactsResult {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchContacts = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Merge view filters with custom filters
            const viewFilters = VIEW_FILTERS[view];
            console.log('[useContacts] view:', view);
            console.log('[useContacts] viewFilters:', viewFilters);

            // Intelligent merge: only override view filters if initialFilters has actual values
            const mergedFilters = { ...viewFilters };

            // Merge initialFilters, but preserve viewFilters.status if initialFilters.status is empty
            Object.keys(initialFilters).forEach(key => {
                const value = initialFilters[key as keyof ContactsFilters];
                // Only override if value is meaningful (not empty array, not empty string, not null/undefined)
                if (value !== undefined && value !== null && value !== '') {
                    if (Array.isArray(value)) {
                        if (value.length > 0) {
                            mergedFilters[key as keyof ContactsFilters] = value as any;
                        }
                    } else {
                        mergedFilters[key as keyof ContactsFilters] = value as any;
                    }
                }
            });

            console.log('[useContacts] mergedFilters:', mergedFilters);

            // Build query params
            const params = new URLSearchParams();

            if (mergedFilters.page) params.append('page', mergedFilters.page.toString());
            if (mergedFilters.limit) params.append('limit', mergedFilters.limit.toString());
            if (mergedFilters.search) params.append('search', mergedFilters.search);
            if (mergedFilters.sortBy) params.append('sort_by', mergedFilters.sortBy);
            if (mergedFilters.sortOrder) params.append('sort_order', mergedFilters.sortOrder);

            if (mergedFilters.status && mergedFilters.status.length > 0) {
                console.log('[useContacts] Adding status filter:', mergedFilters.status);
                params.append('status', mergedFilters.status.join(','));
            }

            if (mergedFilters.semester && mergedFilters.semester.length > 0) {
                params.append('semester', mergedFilters.semester.join(','));
            }

            if (mergedFilters.course && mergedFilters.course.length > 0) {
                params.append('course', mergedFilters.course.join(','));
            }

            if (mergedFilters.lastMessagePeriod) {
                params.append('last_message_period', mergedFilters.lastMessagePeriod);
            }

            if (mergedFilters.showOnlyNew) {
                params.append('is_new', '1');
            }

            if (mergedFilters.showOnlyStatusChanged) {
                params.append('status_changed', '1');
            }

            // Special handling for 'outros' view - exclude known statuses
            if (view === 'outros') {
                const knownStatuses = [
                    'NOVO', 'LEAD',  // leads view
                    'INSCRITO', 'Inscrito Confirmado', 'Aprovado', 'Reprovado',  // inscritos view
                    'Pagamento da Matrícula Iniciado', 'Matricula Confirmada', 'Desistente'
                ];
                params.append('exclude_status', knownStatuses.join(','));
            }

            const response = await fetch(`/api/leads?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Failed to fetch contacts');
            }

            const data = await response.json();

            setContacts(data.data || []);
            setTotalPages(data.pagination?.totalPages || 1);
            setTotalCount(data.pagination?.total || 0);
            setCurrentPage(data.pagination?.page || 1);
        } catch (err) {
            setError(err instanceof Error ? getErrorMessage(err) : 'Unknown error');
            console.error('Error fetching contacts:', err);
        } finally {
            setLoading(false);
        }
    }, [view, initialFilters]);

    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);

    return {
        contacts,
        loading,
        error,
        totalPages,
        totalCount,
        currentPage,
        refresh: fetchContacts
    };
}
