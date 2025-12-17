'use client';

import { useState, useEffect } from 'react';
import { Forward } from 'lucide-react';

import { getErrorMessage } from '@/lib/types';
import ChatList from '@/components/whatsapp-chat/ChatList';
import MessageArea from '@/components/whatsapp-chat/MessageArea';
import type { ChatInfo } from '@/services/WhatsAppChatService';
import { useToast } from '@/contexts/ToastContext';
import { useSocketContacts } from '@/hooks/useSocketContacts';
import styles from './page.module.css';

export default function WhatsAppChatPage() {
    const { success: toastSuccess, error: toastError } = useToast();
    const [chats, setChats] = useState<ChatInfo[]>([]);
    const [selectedChat, setSelectedChat] = useState<ChatInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [comercialPhone, setComercialPhone] = useState('');
    const [comercialName, setComercialName] = useState('');
    const [forwarding, setForwarding] = useState(false);

    // Socket hook for real-time updates with notifications
    const { refreshTrigger } = useSocketContacts();

    // Log every time refreshTrigger changes (for debugging)
    console.log(`[WhatsAppChat] 🔍 Current refreshTrigger value: ${refreshTrigger}`);

    // Forward to comercial
    const handleForwardToComercial = async () => {
        if (!selectedChat || !comercialPhone) return;

        // Use phone property which contains the clean phone number
        const contactPhone = selectedChat.phone?.trim();

        if (!contactPhone) {
            toastError('Telefone do contato não disponível');
            return;
        }

        console.log('[WhatsAppChat] Forwarding contact:', contactPhone);

        setForwarding(true);
        try {
            const res = await fetch('/api/forward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cpf: contactPhone, // Using phone as CPF for WhatsApp POC
                    comercialPhone: comercialPhone,
                    comercialName: comercialName || 'Comercial'
                })
            });

            if (res.ok) {
                toastSuccess('✅ Lead encaminhado para o comercial com sucesso!');
            } else {
                const errorData = await res.json();
                toastError(errorData.error || 'Erro ao encaminhar lead');
            }
        } catch (error) {
            console.error('Error forwarding:', error);
            toastError('Erro ao encaminhar lead');
        } finally {
            setForwarding(false);
        }
    };

    // Initial load
    useEffect(() => {
        console.log('[WhatsAppChat] Initial load - fetching settings and chats');
        loadSettings();
        fetchChats();
    }, []);

    // Reload chats when socket triggers update (new message notification)
    useEffect(() => {
        if (refreshTrigger > 0) {
            console.log(`[WhatsAppChat] 🔄 refreshTrigger changed to ${refreshTrigger} - Reloading chats...`);
            fetchChats();
        }
    }, [refreshTrigger]);

    // Fetch settings (comercial phone/name)
    const loadSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.comercialPhone) setComercialPhone(data.comercialPhone);
            if (data.comercialName) setComercialName(data.comercialName);
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    // Fetch chats
    const fetchChats = async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch('/api/whatsapp-chats');
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao carregar chats');
            }

            setChats(data.chats || []);
        } catch (err: unknown) {
            console.error('[WhatsAppChat] Error loading chats:', err);
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleChatSelect = (chat: ChatInfo) => {
        console.log('[WhatsAppChat] Chat selected:', chat.name, chat.id);

        // Clear unread count for this chat
        if (chat.unreadCount > 0) {
            setChats(prevChats =>
                prevChats.map(c =>
                    c.id === chat.id ? { ...c, unreadCount: 0 } : c
                )
            );
        }

        setSelectedChat(chat);
    };

    // Filter chats based on searchTerm
    const filteredChats = chats.filter(chat =>
        chat.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={styles.container}>
            <div className={styles.chatLayout}>
                <ChatList
                    chats={filteredChats}
                    selectedChat={selectedChat}
                    onSelectChat={handleChatSelect}
                    loading={loading}
                    error={error}
                    onRetry={fetchChats}
                />

                <MessageArea
                    selectedChat={selectedChat}
                    comercialPhone={comercialPhone}
                    comercialName={comercialName}
                    onForward={handleForwardToComercial}
                    forwarding={forwarding}
                />
            </div>
        </div>
    );
}
