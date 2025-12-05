/**
 * Hook for managing contact selection state
 */

import { useState, useCallback } from 'react';

export function useContactsSelection() {
    const [selected, setSelected] = useState<string[]>([]);

    const toggleSelect = useCallback((cpf: string) => {
        setSelected(prev =>
            prev.includes(cpf)
                ? prev.filter(c => c !== cpf)
                : [...prev, cpf]
        );
    }, []);

    const toggleSelectAll = useCallback((allCpfs: string[]) => {
        setSelected(prev =>
            prev.length === allCpfs.length
                ? []
                : allCpfs
        );
    }, []);

    const clearSelection = useCallback(() => {
        setSelected([]);
    }, []);

    const isSelected = useCallback((cpf: string) => {
        return selected.includes(cpf);
    }, [selected]);

    const isAllSelected = useCallback((allCpfs: string[]) => {
        return allCpfs.length > 0 && selected.length === allCpfs.length;
    }, [selected]);

    return {
        selected,
        toggleSelect,
        toggleSelectAll,
        clearSelection,
        isSelected,
        isAllSelected,
        selectedCount: selected.length
    };
}
