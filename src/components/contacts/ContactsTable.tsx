/**
 * ContactsTable - Main table component for displaying contacts
 * Refactored to use useContactsActions and ContactsTableHeader
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { useContacts } from '@/hooks/useContacts';
import { useContactsFilters } from '@/hooks/useContactsFilters';
import { useContactsSelection } from '@/hooks/useContactsSelection';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';
import { useContactsActions } from '@/hooks/useContactsActions';
import { useVisibleColumns } from '@/hooks/useVisibleColumns';

import { ContactsTabs } from './ContactsTabs';
import { ContactsFilters } from './ContactsFilters';
import { ContactsTableHeader } from './ContactsTableHeader';
import { ContactsPagination } from './ContactsPagination';
import { ContactsTableRow } from './ContactsTableRow';
import { ColumnSelector } from './ColumnSelector';

import { ContactEditModal } from './ContactEditModal';
import { MessageModal } from './MessageModal';
import { BulkMessageModal } from './BulkMessageModal';
import { ActivityTimeline } from './ActivityTimeline';
import { ContactsDeleteModal } from './ContactsDeleteModal';

import type { ContactView, Contact } from '@/types/contacts';
import type { Tag } from '@/types/tag';
import styles from './ContactsTable.module.css';
import { UserPlus, RefreshCw, MessageSquare, Download, X } from 'lucide-react';

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
    const { contacts, loading, error, totalPages, totalCount, currentPage, refresh } = useContacts(view, filters);
    const { selected, toggleSelect, toggleSelectAll, clearSelection, isSelected, isAllSelected, selectedCount } = useContactsSelection();

    // Actions hook
    const {
        comercialPhone,
        comercialName,
        deleteConfirmContact,
        handleExport,
        handleForwardToComercial,
        handleDelete,
        cancelDelete,
        confirmDelete
    } = useContactsActions({ refresh });

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
    const [timelineModalOpen, setTimelineModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

    // Tags state - map of CPF to tags
    const [leadTags, setLeadTags] = useState<Map<string, Tag[]>>(new Map());

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

    // Load tags for all contacts
    useEffect(() => {
        const loadTagsForContacts = async () => {
            if (contacts.length === 0) return;

            const tagsMap = new Map<string, Tag[]>();

            // Load tags for each contact
            await Promise.all(
                contacts.map(async (contact) => {
                    try {
                        const response = await fetch(`/api/leads/${contact.cpf}/tags`);
                        if (response.ok) {
                            const data = await response.json();
                            tagsMap.set(contact.cpf, data.data || []);
                        }
                    } catch (error) {
                        console.error(`Error loading tags for ${contact.cpf}:`, error);
                    }
                })
            );

            setLeadTags(tagsMap);
        };

        loadTagsForContacts();
    }, [contacts]);

    const handleSendMessage = (contact: Contact) => {
        setSelectedContact(contact);
        setMessageModalOpen(true);
    };

    const handleEdit = (contact: Contact) => {
        setSelectedContact(contact);
        setEditModalOpen(true);
    };

    const handleViewTimeline = (contact: Contact) => {
        setSelectedContact(contact);
        setTimelineModalOpen(true);
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
                        <>
                            <button
                                className={styles.bulkActionButton}
                                onClick={() => handleExport(selected)}
                                title="Exportar contatos selecionados para CSV"
                            >
                                <Download size={18} />
                                Exportar CSV ({selectedCount})
                            </button>

                            <button
                                className={styles.bulkActionButton}
                                onClick={() => setBulkMessageModalOpen(true)}
                                title="Enviar mensagem para selecionados"
                            >
                                <MessageSquare size={18} />
                                Enviar Mensagem ({selectedCount})
                            </button>
                        </>
                    )}
                    <button onClick={() => setCreateModalOpen(true)} className={styles.newContactButton}>
                        <UserPlus size={18} />
                        Novo Contato
                    </button>
                    <button onClick={refresh} className={styles.iconButton} title="Atualizar">
                        <RefreshCw size={18} className={loading ? styles.spinning : ''} />
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
                    <ContactsTableHeader
                        contacts={contacts}
                        visibleColumns={visibleColumns}
                        filters={filters}
                        updateFilters={updateFilters}
                        isAllSelected={isAllSelected}
                        toggleSelectAll={toggleSelectAll}
                    />
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
                                <ContactsTableRow
                                    key={contact.cpf}
                                    contact={contact}
                                    isSelected={isSelected(contact.cpf)}
                                    visibleColumns={visibleColumns}
                                    tags={leadTags.get(contact.cpf) || []}
                                    comercialPhone={comercialPhone}
                                    comercialName={comercialName}
                                    onSelect={toggleSelect}
                                    onTagsChange={(newTags) => {
                                        const updatedMap = new Map(leadTags);
                                        updatedMap.set(contact.cpf, newTags);
                                        setLeadTags(updatedMap);
                                    }}
                                    onSendMessage={handleSendMessage}
                                    onEdit={handleEdit}
                                    onViewTimeline={handleViewTimeline}
                                    onDelete={handleDelete}
                                    onForwardToComercial={handleForwardToComercial}
                                    onSyncComplete={refresh}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <ContactsPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={filters.limit || 25}
                onPageChange={(page) => updateFilter('page', page)}
                onPageSizeChange={(size) => updateFilters({ limit: size, page: 1 })}
            />

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

            <ActivityTimeline
                contact={selectedContact}
                isOpen={timelineModalOpen}
                onClose={() => setTimelineModalOpen(false)}
            />

            <BulkMessageModal
                contacts={contacts.filter(c => isSelected(c.cpf))}
                isOpen={bulkMessageModalOpen}
                onClose={() => setBulkMessageModalOpen(false)}
                onComplete={() => {
                    refresh();
                }}
            />

            <ContactsDeleteModal
                contact={deleteConfirmContact}
                onCancel={cancelDelete}
                onConfirm={confirmDelete}
            />
        </div >
    );
}
