'use client';

/**
 * Message Area Component
 * 
 * Main area showing messages and input for selected chat
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './MessageArea.module.css';
import { Send, Paperclip, Mic, Smile, Loader2, Check, CheckCheck, Forward } from 'lucide-react';
import { useSocketMessagesPhone } from '@/hooks/useSocketMessagesPhone';
import type { ChatInfo } from '@/services/WhatsAppChatService';
import type { ChatMessage } from '@/services/WhatsAppChatService';

interface MessageAreaProps {
    selectedChat: ChatInfo | null;
    comercialPhone?: string;
    comercialName?: string;
    onForward?: () => void;
    forwarding?: boolean;
}

export default function MessageArea({ selectedChat, comercialPhone, comercialName, onForward, forwarding }: MessageAreaProps) {
    console.log('[MessageArea] Component mounted/updated, selectedChat:', selectedChat?.name, selectedChat?.phone);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // WebSocket real-time messages using phone number
    const handleNewSocketMessage = useCallback((message: any) => {
        console.log('[MessageArea] ✅ Nova mensagem via WebSocket:', message);

        // Convert to ChatMessage format
        const chatMessage: ChatMessage = {
            id: message.message_id || `msg_${Date.now()}`,
            body: message.body,
            fromMe: message.direction === 'outgoing',
            timestamp: new Date(message.timestamp).getTime() / 1000,
            hasMedia: !!message.media_url,
            mediaUrl: message.media_url,
            mediaType: message.media_type,
            status: message.status as any,
            ack: 0
        };

        // Deduplication: only add if not already in messages
        setMessages(prev => {
            const exists = prev.some(m => m.id === chatMessage.id);
            if (exists) {
                console.log('[MessageArea] ⚠️ Message already exists, skipping duplicate:', chatMessage.id);
                return prev;
            }
            console.log('[MessageArea] ➕ Adding new message:', chatMessage.id);
            return [...prev, chatMessage];
        });
    }, []);

    useSocketMessagesPhone({
        phone: selectedChat?.phone || null,
        onNewMessage: handleNewSocketMessage,
        enabled: !!selectedChat
    });

    // Load messages when chat is selected
    useEffect(() => {
        if (selectedChat) {
            loadMessages();
        }
    }, [selectedChat]);

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadMessages = async () => {
        if (!selectedChat) return;

        try {
            setLoading(true);
            const url = `/api/whatsapp-chats/${encodeURIComponent(selectedChat.id)}/messages?limit=50`;
            const res = await fetch(url);
            const data = await res.json();

            if (res.ok) {
                setMessages(data.messages);
            } else {
                console.error('[MessageArea] Error:', data.error);
            }
        } catch (error) {
            console.error('[MessageArea] Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newMessage.trim() || !selectedChat || sending) return;

        const messageText = newMessage.trim();
        setNewMessage('');
        setSending(true);

        try {
            // Use existing send API with chatId (phone number)
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telefone: selectedChat.phone,
                    message: messageText
                })
            });

            const data = await res.json();

            if (res.ok) {
                // Add to messages optimistically
                const newMsg: ChatMessage = {
                    id: `temp_${Date.now()}`,
                    body: messageText,
                    fromMe: true,
                    timestamp: Math.floor(Date.now() / 1000),
                    hasMedia: false,
                    mediaUrl: null,
                    mediaType: null,
                    status: 'sent',
                    ack: 1
                };
                setMessages(prev => [...prev, newMsg]);
            } else {
                console.error('[MessageArea] Send error:', data.error);
                alert(`Erro ao enviar: ${data.error}`);
                setNewMessage(messageText); // Restore message
            }
        } catch (error) {
            console.error('[MessageArea] Send error:', error);
            alert('Erro ao enviar mensagem');
            setNewMessage(messageText); // Restore message
        } finally {
            setSending(false);
        }
    };

    const formatMessageTime = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessageStatus = (msg: ChatMessage) => {
        if (!msg.fromMe) return null;

        if (msg.status === 'read' || msg.ack >= 3) {
            return <CheckCheck size={16} className={styles.checkRead} />;
        } else if (msg.status === 'delivered' || msg.ack === 2) {
            return <CheckCheck size={16} className={styles.checkDelivered} />;
        } else {
            return <Check size={16} className={styles.checkSent} />;
        }
    };

    if (!selectedChat) {
        return (
            <div className={styles.messageArea}>
                <div className={styles.emptyState}>
                    <h2>WhatsApp Web</h2>
                    <p>Selecione uma conversa para começar</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.messageArea}>
            {/* Chat Header */}
            <div className={styles.chatHeader}>
                <div className={styles.avatar}>
                    {selectedChat.profilePicUrl ? (
                        <img src={selectedChat.profilePicUrl} alt={selectedChat.name} />
                    ) : (
                        <div className={styles.avatarPlaceholder}>
                            {selectedChat.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
                <div className={styles.headerInfo}>
                    <h3>{selectedChat.leadName || selectedChat.name}</h3>
                    <p>
                        {selectedChat.phone || `Link ID: ${selectedChat.id.split('@')[0].substring(0, 12)}...`}
                    </p>
                </div>
                {comercialPhone && onForward && selectedChat.phone && (
                    <button
                        className={styles.iconButton}
                        onClick={onForward}
                        disabled={forwarding}
                        title={`Encaminhar para ${comercialName || 'Comercial'}`}
                        style={{ marginLeft: 'auto' }}
                    >
                        <Forward size={20} />
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className={styles.messagesContainer}>
                {loading ? (
                    <div className={styles.loading}>
                        <Loader2 size={32} className="animate-spin" />
                    </div>
                ) : (
                    <>
                        {messages.map((msg, index) => (
                            <div
                                key={msg.id || index}
                                className={`${styles.message} ${msg.fromMe ? styles.messageOut : styles.messageIn}`}
                            >
                                <div className={styles.messageBubble}>
                                    <p className={styles.messageText}>{msg.body}</p>
                                    <div className={styles.messageFooter}>
                                        <span className={styles.messageTime}>
                                            {formatMessageTime(msg.timestamp)}
                                        </span>
                                        {renderMessageStatus(msg)}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input */}
            <form className={styles.inputContainer} onSubmit={handleSendMessage}>
                <button type="button" className={styles.iconButton} title="Emoji">
                    <Smile size={24} />
                </button>
                <button type="button" className={styles.iconButton} title="Anexar">
                    <Paperclip size={24} />
                </button>

                <input
                    type="text"
                    placeholder="Digite uma mensagem"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className={styles.messageInput}
                    disabled={sending}
                />

                {newMessage.trim() ? (
                    <button
                        type="submit"
                        className={styles.sendButton}
                        disabled={sending}
                    >
                        {sending ? (
                            <Loader2 size={24} className="animate-spin" />
                        ) : (
                            <Send size={24} />
                        )}
                    </button>
                ) : (
                    <button type="button" className={styles.iconButton} title="Áudio">
                        <Mic size={24} />
                    </button>
                )}
            </form>
        </div>
    );
}
