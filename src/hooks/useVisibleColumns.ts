/**
 * Hook for managing visible columns in contacts table
 */

import { useState, useEffect } from 'react';

export interface VisibleColumns {
    cpf: boolean;
    telefone: boolean;
    status: boolean;
    semestre: boolean;
    ultima_mensagem: boolean;
}

const DEFAULT_COLUMNS: VisibleColumns = {
    cpf: true,
    telefone: true,
    status: true,
    semestre: true,
    ultima_mensagem: true
};

export function useVisibleColumns() {
    const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>(() => {
        if (typeof window === 'undefined') return DEFAULT_COLUMNS;

        try {
            const saved = localStorage.getItem('contacts_visible_columns');
            return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
        } catch (error) {
            console.error('Error loading visible columns:', error);
            return DEFAULT_COLUMNS;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('contacts_visible_columns', JSON.stringify(visibleColumns));
        } catch (error) {
            console.error('Error saving visible columns:', error);
        }
    }, [visibleColumns]);

    const toggleColumn = (column: keyof VisibleColumns) => {
        setVisibleColumns(prev => ({
            ...prev,
            [column]: !prev[column]
        }));
    };

    const resetColumns = () => {
        setVisibleColumns(DEFAULT_COLUMNS);
    };

    return {
        visibleColumns,
        toggleColumn,
        resetColumns
    };
}
