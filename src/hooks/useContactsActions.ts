import { useState, useEffect } from 'react';
import type { Contact } from '@/types/contacts';
import { useToast } from '@/contexts/ToastContext';

interface UseContactsActionsProps {
    refresh: () => void;
}

export function useContactsActions({ refresh }: UseContactsActionsProps) {
    const { success, error: toastError } = useToast();
    const [comercialPhone, setComercialPhone] = useState('');
    const [comercialName, setComercialName] = useState('');
    const [deleteConfirmContact, setDeleteConfirmContact] = useState<Contact | null>(null);

    // Load commercial settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const res = await fetch('/api/settings');
                const data = await res.json();
                if (data.comercialPhone) setComercialPhone(data.comercialPhone);
                if (data.comercialName) setComercialName(data.comercialName);
            } catch (err) {
                console.error('Error fetching settings:', err);
            }
        };
        loadSettings();
    }, []);

    const handleExport = (selected: string[]) => {
        if (selected.length === 0) {
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

    const handleDelete = (contact: Contact, e?: React.MouseEvent) => {
        e?.stopPropagation();
        e?.preventDefault();
        setDeleteConfirmContact(contact);
    };

    const cancelDelete = () => {
        setDeleteConfirmContact(null);
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

    return {
        comercialPhone,
        comercialName,
        deleteConfirmContact,
        handleExport,
        handleForwardToComercial,
        handleDelete,
        cancelDelete,
        confirmDelete
    };
}
