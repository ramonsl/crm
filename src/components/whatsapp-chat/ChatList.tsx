'use client';

/**
 * Chat List Component
 * 
 * Sidebar showing list of WhatsApp chats
 */

import { useState } from 'react';
import styles from './ChatList.module.css';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import type { ChatInfo } from '@/services/WhatsAppChatService';
import { StatusBadge } from '@/components/contacts/StatusBadge';
import { useStatuses } from '@/contexts/StatusContext';

interface ChatListProps {
    chats: ChatInfo[];
    selectedChat: ChatInfo | null;
    onSelectChat: (chat: ChatInfo) => void;
    loading: boolean;
    error: string | null;
    onRefresh?: () => void;
    onRetry?: () => void;
}

export default function ChatList({
    chats,
    selectedChat,
    onSelectChat,
    loading,
    error,
    onRefresh,
    onRetry
}: ChatListProps) {
    const handleRefresh = onRefresh || onRetry || (() => { });
    const [searchQuery, setSearchQuery] = useState('');
    const { getStatusColor } = useStatuses();

    const filteredChats = chats.filter(chat =>
        chat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatTime = (timestamp: number | null) => {
        if (!timestamp) return '';

        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
            return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } else if (daysDiff === 1) {
            return 'Ontem';
        } else if (daysDiff < 7) {
            return date.toLocaleDateString('pt-BR', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        }
    };

    return (
        <div className={styles.chatList}>
            {/* Header */}
            <div className={styles.header}>
                <h2>Conversas</h2>
                <button
                    className={styles.refreshButton}
                    onClick={handleRefresh}
                    disabled={loading}
                    title="Atualizar"
                >
                    {loading ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : (
                        <RefreshCw size={20} />
                    )}
                </button>
            </div>

            {/* Search */}
            <div className={styles.searchContainer}>
                <Search size={16} className={styles.searchIcon} />
                <input
                    type="text"
                    placeholder="Pesquisar ou começar nova conversa"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            {/* Error */}
            {error && (
                <div className={styles.error}>
                    <p>{error}</p>
                    <button onClick={handleRefresh}>Tentar novamente</button>
                </div>
            )}

            {/* Chat List */}
            <div className={styles.chatsContainer}>
                {loading && chats.length === 0 ? (
                    <div className={styles.loading}>
                        <Loader2 size={32} className="animate-spin" />
                        <p>Carregando conversas...</p>
                    </div>
                ) : filteredChats.length === 0 ? (
                    <div className={styles.empty}>
                        <p>Nenhuma conversa encontrada</p>
                    </div>
                ) : (
                    filteredChats.map((chat) => {
                        // Get status color
                        const statusColor = chat.status ? getStatusColor(chat.status) : '#6b7280';

                        return (
                            <div
                                key={chat.id}
                                className={`${styles.chatItem} ${selectedChat?.id === chat.id ? styles.selected : ''}`}
                                onClick={() => onSelectChat(chat)}
                            >
                                {/* Avatar */}
                                <div className={styles.avatar}>
                                    {chat.profilePicUrl ? (
                                        <img
                                            src={chat.profilePicUrl}
                                            alt={chat.name}
                                            onError={(e) => {
                                                // Gracefully handle failed image loads
                                                console.warn(`[ChatList] Failed to load profile pic for ${chat.name}`);
                                                e.currentTarget.style.display = 'none';
                                                // Show placeholder instead
                                                const placeholder = e.currentTarget.nextElementSibling;
                                                if (placeholder) {
                                                    (placeholder as HTMLElement).style.display = 'flex';
                                                }
                                            }}
                                            style={{ border: `3px solid ${statusColor}` }}
                                        />
                                    ) : null}
                                    <div
                                        className={styles.avatarPlaceholder}
                                        style={{
                                            display: chat.profilePicUrl ? 'none' : 'flex',
                                            backgroundColor: statusColor
                                        }}
                                    >
                                        {(chat.leadName || chat.name).charAt(0).toUpperCase()}
                                    </div>
                                </div>
                                {/* Info */}
                                <div className={styles.chatInfo}>
                                    <div className={styles.chatHeader}>
                                        <div className={styles.nameStatusAndPhone}>
                                            <div className={styles.nameAndStatus}>
                                                <h3 className={styles.chatName}>
                                                    {chat.leadName || chat.name}
                                                    {chat.isRegistered && (
                                                        <span className={styles.registeredIndicator} title="Cadastrado no CRM">
                                                            ✓
                                                        </span>
                                                    )}
                                                </h3>
                                                {chat.status && !chat.isGroup && (
                                                    <StatusBadge status={chat.status} className={styles.statusTag} />
                                                )}
                                            </div>
                                            {chat.phone && (
                                                <span className={styles.chatPhone}>{chat.phone}</span>
                                            )}
                                        </div>
                                        <span className={styles.chatTime}>
                                            {formatTime(chat.lastMessageTime)}
                                        </span>
                                    </div>

                                    <div className={styles.chatFooter}>
                                        <p className={styles.lastMessage}>
                                            {chat.lastMessage || 'Sem mensagens'}
                                        </p>
                                        {chat.unreadCount > 0 && (
                                            <span className={styles.unreadBadge}>
                                                {chat.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
