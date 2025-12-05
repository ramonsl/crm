/**
 * Hook for managing contacts filters state
 */

import { useState, useCallback } from 'react';
import type { ContactsFilters } from '@/types/contacts';

export function useContactsFilters(initialFilters: Partial<ContactsFilters> = {}) {
    const [filters, setFilters] = useState<ContactsFilters>({
        search: '',
        status: [],
        semester: [],
        course: [],
        lastMessagePeriod: '',
        showOnlyNew: false,
        showOnlyStatusChanged: false,
        page: 1,
        limit: 25,
        sortBy: 'updated_at',
        sortOrder: 'desc',
        ...initialFilters
    });

    const updateFilter = useCallback(<K extends keyof ContactsFilters>(
        key: K,
        value: ContactsFilters[K]
    ) => {
        setFilters(prev => ({ ...prev, [key]: value, page: 1 })); // Reset to page 1 on filter change
    }, []);

    const updateFilters = useCallback((updates: Partial<ContactsFilters>) => {
        setFilters(prev => ({ ...prev, ...updates }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters({
            search: '',
            status: [],
            semester: [],
            course: [],
            lastMessagePeriod: '',
            showOnlyNew: false,
            showOnlyStatusChanged: false,
            page: 1,
            limit: 25,
            sortBy: 'updated_at',
            sortOrder: 'desc',
            ...initialFilters
        });
    }, [initialFilters]);

    return {
        filters,
        updateFilter,
        updateFilters,
        resetFilters,
        setFilters
    };
}
