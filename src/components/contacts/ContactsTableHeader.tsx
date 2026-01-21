import { ChevronUp, ChevronDown } from 'lucide-react';
import type { VisibleColumns } from '@/hooks/useVisibleColumns';
import type { Contact } from '@/types/contacts';

interface ContactsTableHeaderProps {
    contacts: Contact[];
    visibleColumns: VisibleColumns;
    filters: { sortBy?: string; sortOrder?: 'asc' | 'desc' };
    updateFilters: (filters: { sortBy?: string; sortOrder?: 'asc' | 'desc' }) => void;
    isAllSelected: (cpfs: string[]) => boolean;
    toggleSelectAll: (cpfs: string[]) => void;
}

export function ContactsTableHeader({
    contacts,
    visibleColumns,
    filters,
    updateFilters,
    isAllSelected,
    toggleSelectAll
}: ContactsTableHeaderProps) {

    // Handle column sorting
    const handleSort = (column: string) => {
        const currentSort = filters.sortBy;
        const currentOrder = filters.sortOrder;

        let newOrder: 'asc' | 'desc' | undefined;

        if (currentSort === column) {
            // Cycle through: asc -> desc -> none
            if (currentOrder === 'asc') {
                newOrder = 'desc';
            } else if (currentOrder === 'desc') {
                newOrder = undefined; // Remove sorting
            } else {
                newOrder = 'asc';
            }
        } else {
            // New column, start with asc
            newOrder = 'asc';
        }

        updateFilters({
            sortBy: newOrder ? column : undefined,
            sortOrder: newOrder
        });
    };

    // Render sort indicator
    const renderSortIndicator = (column: string) => {
        if (filters.sortBy !== column) return null;

        return filters.sortOrder === 'asc' ? (
            <ChevronUp size={14} style={{ display: 'inline', marginLeft: '4px' }} />
        ) : (
            <ChevronDown size={14} style={{ display: 'inline', marginLeft: '4px' }} />
        );
    };

    return (
        <thead>
            <tr>
                <th>
                    <input
                        type="checkbox"
                        checked={contacts.length > 0 && isAllSelected(contacts.map(c => c.cpf))}
                        onChange={() => toggleSelectAll(contacts.map(c => c.cpf))}
                    />
                </th>
                <th>Foto</th>
                <th
                    onClick={() => handleSort('nome')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Clique para ordenar"
                >
                    Nome / Telefone {renderSortIndicator('nome')}
                </th>
                {visibleColumns.cpf && (
                    <th
                        onClick={() => handleSort('cpf')}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        title="Clique para ordenar"
                    >
                        CPF {renderSortIndicator('cpf')}
                    </th>
                )}
                {visibleColumns.status && (
                    <th
                        onClick={() => handleSort('status')}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        title="Clique para ordenar"
                    >
                        Status {renderSortIndicator('status')}
                    </th>
                )}
                {visibleColumns.semestre && (
                    <th
                        onClick={() => handleSort('tipo_ingresso')}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        title="Clique para ordenar"
                    >
                        Semestre {renderSortIndicator('tipo_ingresso')}
                    </th>
                )}
                {visibleColumns.ultima_mensagem && (
                    <th
                        onClick={() => handleSort('last_message_time')}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        title="Clique para ordenar"
                    >
                        Última Mensagem {renderSortIndicator('last_message_time')}
                    </th>
                )}
                <th style={{ width: '200px' }}>Tags</th>
                <th>Ações</th>
            </tr>
        </thead>
    );
}
