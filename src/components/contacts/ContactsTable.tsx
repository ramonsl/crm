/**
 * ContactsTable - Main table component for displaying contacts
 * This is a simplified version that will be enhanced iteratively
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { useContacts } from '@/hooks/useContacts';
import { useContactsFilters } from '@/hooks/useContactsFilters';
import { useContactsSelection } from '@/hooks/useContactsSelection';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';
import { ContactsTabs } from './ContactsTabs';
import { ContactsFilters } from './ContactsFilters';
import { StatusBadge } from './StatusBadge';
import { ProfileAvatar } from './ProfileAvatar';
import { ContactEditModal } from './ContactEditModal';
import { MessageModal } from './MessageModal';
import { BulkMessageModal } from './BulkMessageModal';
import { HistoryModal } from './HistoryModal';
import TimeAgoBadge from '@/components/TimeAgoBadge';
import WhatsAppIndicator from '@/components/WhatsAppIndicator';
import type { ContactView, Contact } from '@/types/contacts';
import styles from './ContactsTable.module.css';
import { UserPlus, RefreshCw, MessageSquare, Edit2, Trash2, History, Download, Upload, Filter, X, ChevronUp, ChevronDown } from 'lucide-react';
import { ColumnSelector } from './ColumnSelector';
import { useVisibleColumns } from '@/hooks/useVisibleColumns';

interface ContactsTableProps {
    view?: ContactView;
    showTabs?: boolean;
}

export function ContactsTable({
    view = 'all',
    showTabs = true
}: ContactsTableProps) {
    const { success, error: toastError } = useToast();
    const { filters, updateFilter, updateFilters, resetFilters } = useContactsFilters({ page: 1, limit: 25 });
    const { contacts, loading, error, totalPages, currentPage, refresh } = useContacts(view, filters);
    const { selected, toggleSelect, toggleSelectAll, clearSelection, isSelected, isAllSelected, selectedCount } = useContactsSelection();
    const { status: waStatus, isReady } = useWhatsAppStatus();

    const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
    const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
    const [availableCourses, setAvailableCourses] = useState<string[]>([]);

    // Visible columns management
    const { visibleColumns, toggleColumn, resetColumns } = useVisibleColumns();

    // Modal state
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [messageModalOpen, setMessageModalOpen] = useState(false);
    const [bulkMessageModalOpen, setBulkMessageModalOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

    // Fetch available filter options from database
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const res = await fetch('/api/filters');
                const data = await res.json();

                if (data.statuses) {
                    setAvailableStatuses(data.statuses);
                }
                if (data.semesters) {
                    setAvailableSemesters(data.semesters);
                }
                if (data.courses) {
                    setAvailableCourses(data.courses);
                }
            } catch (error) {
                console.error('Error fetching filters:', error);
            }
        };

        fetchFilters();
    }, []);

    const handleExport = async () => {
        try {
            const params = new URLSearchParams();
            if (filters.search) params.append('search', filters.search);
            if (filters.status && filters.status.length > 0) params.append('status', filters.status.join(','));

            const response = await fetch(`/api/leads/export?${params.toString()}`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `contacts_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Export error:', err);
        }
    };

    const handleSendMessage = (contact: Contact) => {
        setSelectedContact(contact);
        setMessageModalOpen(true);
    };

    const handleEdit = (contact: Contact) => {
        setSelectedContact(contact);
        setEditModalOpen(true);
    };

    const handleViewHistory = (contact: Contact) => {
        setSelectedContact(contact);
        setHistoryModalOpen(true);
    };

    const handleDelete = async (contact: any) => {
        if (!window.confirm(`Tem certeza que deseja deletar ${contact.nome}?\n\nEsta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            // Use CPF if available, otherwise use telefone
            const identifier = contact.cpf && contact.cpf.trim() !== ''
                ? `cpf=${encodeURIComponent(contact.cpf)}`
                : `telefone=${encodeURIComponent(contact.telefone)}`;

            const response = await fetch(`/api/leads?${identifier}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                success('Contato deletado com sucesso!');
                refresh();
            } else {
                const data = await response.json();
                toastError(`Erro ao deletar: ${data.error || 'Erro desconhecido'}`);
            }
        } catch (err) {
            console.error('Delete error:', err);
            toastError('Erro ao deletar contato');
        }
    };

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

    if (error) {
        return (
            <div className={styles.error}>
                <p>Erro ao carregar contatos: {error}</p>
                <button onClick={refresh}>Tentar novamente</button>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {showTabs && <ContactsTabs activeView={view} />}

            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h2>Contatos</h2>
                    {selectedCount > 0 && (
                        <div
                            className={styles.selectionInfo}
                            onClick={clearSelection}
                            title="Clique para desselecionar todos"
                        >
                            <span>{selectedCount} selecionado(s)</span>
                            <X size={14} />
                        </div>
                    )}
                </div>
                <div className={styles.headerActions}>
                    {selectedCount > 0 && (
                        <button
                            className={styles.bulkActionButton}
                            onClick={() => setBulkMessageModalOpen(true)}
                            title="Enviar mensagem para selecionados"
                        >
                            <MessageSquare size={18} />
                            Enviar Mensagem ({selectedCount})
                        </button>
                    )}
                    <button onClick={() => setCreateModalOpen(true)} className={styles.newContactButton}>
                        <UserPlus size={18} />
                        Novo Contato
                    </button>
                    <button onClick={refresh} className={styles.iconButton} title="Atualizar">
                        <RefreshCw size={18} className={loading ? styles.spinning : ''} />
                    </button>
                    <button onClick={handleExport} className={styles.iconButton} title="Exportar CSV">
                        <Download size={18} />
                    </button>
                    <ColumnSelector
                        visibleColumns={visibleColumns}
                        onToggle={toggleColumn}
                        onReset={resetColumns}
                    />
                    {selectedCount > 0 && (
                        <span className={styles.selectedCount}>
                            {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>

            {/* Filters */}
            <ContactsFilters
                filters={filters}
                onFilterChange={updateFilter}
                onReset={resetFilters}
                availableStatuses={availableStatuses}
                availableSemesters={availableSemesters}
                availableCourses={availableCourses}
            />

            {/* Table */}
            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>
                                <input
                                    type="checkbox"
                                    checked={isAllSelected(contacts.map(c => c.cpf))}
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
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={9} className={styles.loading}>
                                    Carregando...
                                </td>
                            </tr>
                        ) : contacts.length === 0 ? (
                            <tr>
                                <td colSpan={9} className={styles.empty}>
                                    Nenhum contato encontrado
                                </td>
                            </tr>
                        ) : (
                            contacts.map((contact) => (
                                <tr key={contact.cpf} className={isSelected(contact.cpf) ? styles.selected : ''}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={isSelected(contact.cpf)}
                                            onChange={() => toggleSelect(contact.cpf)}
                                        />
                                    </td>
                                    <td>
                                        <ProfileAvatar contact={contact} size="medium" />
                                    </td>
                                    <td>
                                        <div className={styles.namePhoneCell}>
                                            <div className={styles.nameRow}>
                                                <span className={styles.contactName}>{contact.nome}</span>
                                                {contact.is_new === 1 && <span className={styles.newBadge}>NOVO</span>}
                                            </div>
                                            <div className={styles.phoneRow}>
                                                <span className={styles.phoneNumber}>{contact.telefone}</span>
                                                <WhatsAppIndicator
                                                    phone={contact.telefone}
                                                    onSyncComplete={refresh}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    {visibleColumns.cpf && <td>{contact.cpf}</td>}
                                    {visibleColumns.status && (
                                        <td>
                                            <StatusBadge status={contact.status} />
                                        </td>
                                    )}
                                    {visibleColumns.semestre && <td>{contact.tipo_ingresso || '-'}</td>}
                                    {visibleColumns.ultima_mensagem && (
                                        <td>
                                            {contact.last_message_time ? (
                                                <TimeAgoBadge date={contact.last_message_time} />
                                            ) : (
                                                <span className={styles.noMessage}>Nunca</span>
                                            )}
                                        </td>
                                    )}
                                    <td>
                                        <div className={styles.actions}>
                                            <button
                                                className={styles.actionButton}
                                                title="Enviar mensagem"
                                                onClick={() => handleSendMessage(contact)}
                                            >
                                                <MessageSquare size={16} />
                                            </button>
                                            <button
                                                className={styles.actionButton}
                                                title="Editar"
                                                onClick={() => handleEdit(contact)}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className={styles.actionButton}
                                                title="Histórico"
                                                onClick={() => handleViewHistory(contact)}
                                            >
                                                <History size={16} />
                                            </button>
                                            <button
                                                className={styles.actionButton}
                                                title="Deletar"
                                                onClick={() => handleDelete(contact)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className={styles.pagination}>
                    <button
                        onClick={() => updateFilter('page', Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                    >
                        Anterior
                    </button>
                    <span>
                        Página {currentPage} de {totalPages}
                    </span>
                    <button
                        onClick={() => updateFilter('page', Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Próxima
                    </button>
                </div>
            )}

            {/* Modals */}
            <ContactEditModal
                contact={selectedContact}
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                onSave={(updatedContact) => {
                    refresh();
                    setEditModalOpen(false);
                }}
            />

            {/* Create Modal - using same component but with null contact */}
            <ContactEditModal
                contact={null}
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSave={(newContact) => {
                    refresh();
                    setCreateModalOpen(false);
                }}
            />

            <MessageModal
                contact={selectedContact}
                isOpen={messageModalOpen}
                onClose={() => setMessageModalOpen(false)}
                onSent={() => {
                    refresh();
                }}
            />

            <HistoryModal
                contact={selectedContact}
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
            />

            <BulkMessageModal
                contacts={contacts.filter(c => isSelected(c.cpf))}
                isOpen={bulkMessageModalOpen}
                onClose={() => setBulkMessageModalOpen(false)}
                onComplete={() => {
                    refresh();
                }}
            />
        </div>
    );
}
