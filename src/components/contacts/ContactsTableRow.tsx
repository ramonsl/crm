/**
 * ContactsTableRow - Single row component for contacts table
 * 
 * Follows Single Responsibility Principle (SRP):
 * This component is responsible ONLY for rendering a single contact row.
 * All actions are delegated via callback props.
 * 
 * Follows Dependency Inversion Principle (DIP):
 * Depends on abstractions (callback functions) rather than concrete implementations.
 */

'use client';

import { MessageSquare, Edit2, Trash2, Clock, Forward } from 'lucide-react';
import { ProfileAvatar } from './ProfileAvatar';
import { StatusBadge } from './StatusBadge';
import TimeAgoBadge from '@/components/TimeAgoBadge';
import WhatsAppIndicator from '@/components/WhatsAppIndicator';
import { TagSelector } from '@/components/tags/TagSelector';
import type { Contact } from '@/types/contacts';
import type { Tag } from '@/types/tag';
import styles from './ContactsTable.module.css';

interface VisibleColumns {
    cpf: boolean;
    status: boolean;
    semestre: boolean;
    ultima_mensagem: boolean;
}

interface ContactsTableRowProps {
    /** Contact data to display */
    contact: Contact;
    /** Whether this row is selected */
    isSelected: boolean;
    /** Visible columns configuration */
    visibleColumns: VisibleColumns;
    /** Tags associated with this contact */
    tags: Tag[];
    /** Commercial team phone (if enabled) */
    comercialPhone?: string;
    /** Commercial team name */
    comercialName?: string;
    /** Callback when selection changes */
    onSelect: (cpf: string) => void;
    /** Callback when tags change */
    onTagsChange: (tags: Tag[]) => void;
    /** Callback when send message is clicked */
    onSendMessage: (contact: Contact) => void;
    /** Callback when edit is clicked */
    onEdit: (contact: Contact) => void;
    /** Callback when view timeline is clicked */
    onViewTimeline: (contact: Contact) => void;
    /** Callback when delete is clicked */
    onDelete: (contact: Contact, e: React.MouseEvent) => void;
    /** Callback when forward to commercial is clicked */
    onForwardToComercial?: (contact: Contact) => void;
    /** Callback when data sync completes */
    onSyncComplete?: () => void;
}

export function ContactsTableRow({
    contact,
    isSelected,
    visibleColumns,
    tags,
    comercialPhone,
    comercialName,
    onSelect,
    onTagsChange,
    onSendMessage,
    onEdit,
    onViewTimeline,
    onDelete,
    onForwardToComercial,
    onSyncComplete,
}: ContactsTableRowProps) {
    return (
        <tr className={isSelected ? styles.selected : ''}>
            {/* Checkbox */}
            <td>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelect(contact.cpf)}
                />
            </td>

            {/* Profile Avatar */}
            <td>
                <ProfileAvatar contact={contact} size="medium" />
            </td>

            {/* Name / Phone / Template */}
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
                            cpf={contact.cpf}
                            onSyncComplete={onSyncComplete}
                        />
                    </div>
                    {contact.last_template_sent && (
                        <div className={styles.templateRow}>
                            <span className={styles.templateBadge}>
                                📄 {contact.last_template_sent}
                            </span>
                        </div>
                    )}
                </div>
            </td>

            {/* CPF Column */}
            {visibleColumns.cpf && <td>{contact.cpf}</td>}

            {/* Status Column */}
            {visibleColumns.status && (
                <td>
                    <StatusBadge status={contact.status} />
                </td>
            )}

            {/* Semester Column */}
            {visibleColumns.semestre && <td>{contact.tipo_ingresso || '-'}</td>}

            {/* Last Message Column */}
            {visibleColumns.ultima_mensagem && (
                <td>
                    {contact.last_message_time ? (
                        <TimeAgoBadge date={contact.last_message_time} />
                    ) : (
                        <span className={styles.noMessage}>Nunca</span>
                    )}
                </td>
            )}

            {/* Tags Column */}
            <td>
                <TagSelector
                    leadCpf={contact.cpf}
                    selectedTags={tags}
                    onTagsChange={onTagsChange}
                    inline
                />
            </td>

            {/* Actions Column */}
            <td>
                <div className={styles.actions}>
                    <button
                        className={styles.actionButton}
                        title="Enviar mensagem"
                        onClick={() => onSendMessage(contact)}
                    >
                        <MessageSquare size={16} />
                    </button>

                    {comercialPhone && onForwardToComercial && (
                        <button
                            className={styles.actionButton}
                            title={`Encaminhar para ${comercialName || 'Comercial'}`}
                            onClick={() => onForwardToComercial(contact)}
                        >
                            <Forward size={16} />
                        </button>
                    )}

                    <button
                        className={styles.actionButton}
                        title="Editar"
                        onClick={() => onEdit(contact)}
                    >
                        <Edit2 size={16} />
                    </button>

                    <button
                        className={styles.actionButton}
                        title="Timeline (Histórico completo)"
                        onClick={() => onViewTimeline(contact)}
                    >
                        <Clock size={16} />
                    </button>

                    <button
                        className={styles.actionButton}
                        title="Deletar"
                        onClick={(e) => onDelete(contact, e)}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </td>
        </tr>
    );
}
