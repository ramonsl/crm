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
import { uiLogger } from '@/lib/logger';
import { ContactsTabs } from './ContactsTabs';
import { ContactsFilters } from './ContactsFilters';
import { ContactEditModal } from './ContactEditModal';
import { MessageModal } from './MessageModal';
import { BulkMessageModal } from './BulkMessageModal';
import { ActivityTimeline } from './ActivityTimeline';
import type { ContactView, Contact } from '@/types/contacts';
import type { Tag } from '@/types/tag';
import styles from './ContactsTable.module.css';
import { UserPlus, RefreshCw, MessageSquare, Download, X, ChevronUp, ChevronDown } from 'lucide-react';
import { ColumnSelector } from './ColumnSelector';
import { useVisibleColumns } from '@/hooks/useVisibleColumns';
import { ContactsPagination } from './ContactsPagination';
import { ContactsTableRow } from './ContactsTableRow';

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
    const [timelineModalOpen, setTimelineModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [deleteConfirmContact, setDeleteConfirmContact] = useState<Contact | null>(null);

    // Tags state - map of CPF to tags
    const [leadTags, setLeadTags] = useState<Map<string, Tag[]>>(new Map());

    // Commercial team settings
    const [comercialPhone, setComercialPhone] = useState('');
    const [comercialName, setComercialName] = useState('');

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

        // Load commercial settings
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.comercialPhone) setComercialPhone(data.comercialPhone);
                if (data.comercialName) setComercialName(data.comercialName);
            });
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


    const handleExport = () => {
        if (selectedCount === 0) {
            toastError('Selecione contatos para exportar');
            return;
        }

        const cpfs = selected.join(',');
        const url = `/api/export?cpfs=${encodeURIComponent(cpfs)}`;

        // Force download with anchor tag
        const a = document.createElement('a');
        a.href = url;
        a.download = `contatos-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };



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

    const handleDelete = (contact: any, e?: React.MouseEvent) => {
        e?.stopPropagation();
        e?.preventDefault();
        setDeleteConfirmContact(contact);
    };

    const handleForwardToComercial = async (contact: Contact) => {
        if (!comercialPhone) return;

        try {
            // API forward agora envia mensagem e registra na timeline
            const res = await fetch('/api/forward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cpf: contact.cpf,
                    comercialPhone: comercialPhone,
                    comercialName: comercialName || 'Comercial'
                })
            });

            if (res.ok) {
                success('Lead encaminhado para o comercial!');
            } else {
                const errorData = await res.json();
                if (errorData.needsConnection) {
                    toastError(`⚠️ ${errorData.error}`);
                } else {
                    toastError(`Erro ao encaminhar: ${errorData.error || 'Erro desconhecido'}`);
                }
            }
        } catch (error) {
            console.error('Error forwarding to commercial:', error);
            toastError('Erro ao encaminhar lead. Verifique sua conexão.');
        }
    };

    const confirmDelete = async () => {
        const contact = deleteConfirmContact;
        if (!contact) return;

        setDeleteConfirmContact(null);

        try {
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

    const cancelDelete = () => {
        setDeleteConfirmContact(null);
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
                        <>
                            <button
                                className={styles.bulkActionButton}
                                onClick={handleExport}
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
                            <th style={{ width: '200px' }}>Tags</th>
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

            {/* Delete Confirmation Modal */}
            {
                deleteConfirmContact && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999
                    }}>
                        <div style={{
                            background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)',
                            borderRadius: '16px',
                            padding: '2rem',
                            maxWidth: '400px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                        }}>
                            <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Confirmar Exclusão</h3>
                            <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
                                Tem certeza que deseja deletar <strong style={{ color: '#fff' }}>{deleteConfirmContact.nome}</strong>?
                                <br /><br />
                                Esta ação não pode ser desfeita.
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={cancelDelete}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        background: 'transparent',
                                        color: '#fff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#ef4444',
                                        color: '#fff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Deletar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
