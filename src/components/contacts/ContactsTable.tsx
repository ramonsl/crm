/**
 * ContactsTable - Main table component for displaying contacts
 * Refactored to use useContactsActions and ContactsTableHeader
 */

'use client';

import { useContacts } from '@/hooks/useContacts';
import { useContactsFilters } from '@/hooks/useContactsFilters';
import { useContactsSelection } from '@/hooks/useContactsSelection';
import { useContactsActions } from '@/hooks/useContactsActions';
import { useVisibleColumns } from '@/hooks/useVisibleColumns';
import { useContactsFiltersData } from '@/hooks/useContactsFiltersData';
import { useContactsTags } from '@/hooks/useContactsTags';
import { useContactModals } from '@/hooks/useContactModals';

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
    const { filters, updateFilter, updateFilters, resetFilters } = useContactsFilters({ page: 1, limit: 25 });
    const { contacts, loading, error, totalPages, totalCount, currentPage, refresh } = useContacts(view, filters);
    const { selected, toggleSelect, toggleSelectAll, clearSelection, isSelected, isAllSelected, selectedCount } = useContactsSelection();

    const { availableStatuses, availableSemesters, availableCourses } = useContactsFiltersData();
    const { leadTags, updateLeadTags } = useContactsTags(contacts);
    const { modals, selectedContact, closeModal, handleEdit, handleSendMessage, handleViewTimeline, handleCreate, handleBulkMessage } = useContactModals();

    const { visibleColumns, toggleColumn, resetColumns } = useVisibleColumns();
    const { comercialPhone, comercialName, deleteConfirmContact, handleExport, handleForwardToComercial, handleDelete, cancelDelete, confirmDelete } = useContactsActions({ refresh });

    if (error) return <div className={styles.error}><p>Erro: {error}</p><button onClick={refresh}>Tentar</button></div>;

    return (
        <div className={styles.container}>
            {showTabs && <ContactsTabs activeView={view} />}

            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h2>Contatos</h2>
                    {selectedCount > 0 && (
                        <div className={styles.selectionInfo} onClick={clearSelection}>
                            <span>{selectedCount} selecionado(s)</span>
                            <X size={14} />
                        </div>
                    )}
                </div>
                <div className={styles.headerActions}>
                    {selectedCount > 0 && (
                        <>
                            <button className={styles.bulkActionButton} onClick={() => handleExport(selected)}><Download size={18} /> Exportar CSV</button>
                            <button className={styles.bulkActionButton} onClick={handleBulkMessage}><MessageSquare size={18} /> Enviar Mensagem</button>
                        </>
                    )}
                    <button onClick={handleCreate} className={styles.newContactButton}><UserPlus size={18} /> Novo Contato</button>
                    <button onClick={refresh} className={styles.iconButton}><RefreshCw size={18} className={loading ? styles.spinning : ''} /></button>
                    <ColumnSelector visibleColumns={visibleColumns} onToggle={toggleColumn} onReset={resetColumns} />
                </div>
            </div>

            <ContactsFilters filters={filters} onFilterChange={updateFilter} onReset={resetFilters} availableStatuses={availableStatuses} availableSemesters={availableSemesters} availableCourses={availableCourses} />

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <ContactsTableHeader contacts={contacts} visibleColumns={visibleColumns} filters={filters} updateFilters={updateFilters} isAllSelected={isAllSelected} toggleSelectAll={toggleSelectAll} />
                    <tbody>
                        {loading ? <tr><td colSpan={9} className={styles.loading}>Carregando...</td></tr> :
                            contacts.length === 0 ? <tr><td colSpan={9} className={styles.empty}>Nenhum contato encontrado</td></tr> :
                                contacts.map(c => (
                                    <ContactsTableRow key={c.cpf} contact={c} isSelected={isSelected(c.cpf)} visibleColumns={visibleColumns} tags={leadTags.get(c.cpf) || []} comercialPhone={comercialPhone} comercialName={comercialName} onSelect={toggleSelect} onTagsChange={(tags) => updateLeadTags(c.cpf, tags)} onSendMessage={handleSendMessage} onEdit={handleEdit} onViewTimeline={handleViewTimeline} onDelete={handleDelete} onForwardToComercial={handleForwardToComercial} onSyncComplete={refresh} />
                                ))}
                    </tbody>
                </table>
            </div>

            <ContactsPagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={filters.limit || 25} onPageChange={(p) => updateFilter('page', p)} onPageSizeChange={(s) => updateFilters({ limit: s, page: 1 })} />

            <ContactEditModal contact={selectedContact} isOpen={modals.edit} onClose={() => closeModal('edit')} onSave={() => { refresh(); closeModal('edit'); }} />
            <ContactEditModal contact={null} isOpen={modals.create} onClose={() => closeModal('create')} onSave={() => { refresh(); closeModal('create'); }} />
            <MessageModal contact={selectedContact} isOpen={modals.message} onClose={() => closeModal('message')} onSent={refresh} />
            <ActivityTimeline contact={selectedContact} isOpen={modals.timeline} onClose={() => closeModal('timeline')} />
            <BulkMessageModal contacts={contacts.filter(c => isSelected(c.cpf))} isOpen={modals.bulkMessage} onClose={() => closeModal('bulkMessage')} onComplete={refresh} />
            <ContactsDeleteModal contact={deleteConfirmContact} onCancel={cancelDelete} onConfirm={confirmDelete} />
        </div >
    );
}
