'use client';

import { useState } from 'react';
import type { Contact } from '@/types/contacts';

export function useContactModals() {
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

    const [modals, setModals] = useState({
        edit: false,
        create: false,
        message: false,
        bulkMessage: false,
        timeline: false
    });

    const openModal = (type: keyof typeof modals, contact: Contact | null = null) => {
        if (contact) setSelectedContact(contact);
        setModals(prev => ({ ...prev, [type]: true }));
    };

    const closeModal = (type: keyof typeof modals) => {
        setModals(prev => ({ ...prev, [type]: false }));
        // Only clear selected contact if we're not closing bulk message
        if (type !== 'bulkMessage') {
            // Optional: setSelectedContact(null);
        }
    };

    const handleEdit = (contact: Contact) => openModal('edit', contact);
    const handleSendMessage = (contact: Contact) => openModal('message', contact);
    const handleViewTimeline = (contact: Contact) => openModal('timeline', contact);
    const handleCreate = () => openModal('create', null);
    const handleBulkMessage = () => openModal('bulkMessage');

    return {
        selectedContact,
        setSelectedContact,
        modals,
        openModal,
        closeModal,
        handleEdit,
        handleSendMessage,
        handleViewTimeline,
        handleCreate,
        handleBulkMessage
    };
}
