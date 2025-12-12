'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './page.module.css';
import { MessageCircle, Send, Search, RefreshCw, Check, CheckCheck, Paperclip, FileText, Play, Pause, Mic, Square, X, Filter, Forward } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useStatuses } from '@/contexts/StatusContext';
import { useSocket } from '@/contexts/SocketContext';
import { useSocketMessages } from '@/hooks/useSocketMessages';
import { useSocketContacts } from '@/hooks/useSocketContacts';

interface Contact {
    cpf: string;
    nome: string;
    telefone: string;
    status: string;
    tipo_ingresso: string;
    unread_count: number;
    last_message: string | null;
    last_message_time: string | null;
    last_message_direction: 'incoming' | 'outgoing' | null;
    profile_image: string | null;
}

interface Message {
    id: number;
    message_id?: string;
    direction: 'incoming' | 'outgoing';
    body: string;
    timestamp: string;
    status: string;
    media_url: string | null;
    media_type?: string | null;
}

export default function ChatPage() {
    const { error: toastError, success: toastSuccess } = useToast();
    const { isConnected: socketConnected } = useSocket();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const prevScrollHeightRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Status Context for dynamic statuses
    const { statuses } = useStatuses();

    // Filter States
    const [showUnanswered, setShowUnanswered] = useState(false);
    const [showUnread, setShowUnread] = useState(false);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

    // Commercial team settings
    const [comercialPhone, setComercialPhone] = useState('');
    const [comercialName, setComercialName] = useState('');
    const [forwarding, setForwarding] = useState(false);

    // Fetch contacts
    const fetchContacts = async () => {
        try {
            const res = await fetch('/api/chat/contacts');
            const data = await res.json();
            setContacts(data.contacts);
        } catch (error) {
            console.error('Error fetching contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch messages for selected contact from database
    const fetchMessages = async (cpf: string, silent = false, afterId = 0, offset = 0) => {
        if (!cpf) return;

        try {
            // If fetching history (afterId=0), get more messages (1000) to show full conversation
            // If polling (afterId>0), just get new ones
            const limit = afterId > 0 ? 100 : 50; // Load 50 at a time for history
            const res = await fetch(`/api/chat/messages?cpf=${cpf}&limit=${limit}&after_id=${afterId}&offset=${offset}`);
            console.log(`[Chat] Buscando mensagens: cpf=${cpf}, afterId=${afterId}, offset=${offset}`);
            const data = await res.json();

            if (res.ok && data.messages) {
                console.log(`[Chat] Recebidas ${data.messages.length} mensagens`);

                if (afterId > 0) {
                    // Append new messages
                    if (data.messages.length > 0) {
                        console.log(`[Chat] Polling encontrou ${data.messages.length} novas mensagens`);
                        setMessages(prev => {
                            // Deduplicate just in case
                            const existingIds = new Set(prev.map(m => m.id));
                            const newUnique = data.messages.filter((m: Message) => !existingIds.has(m.id));
                            if (newUnique.length === 0) return prev;

                            const updated = [...prev, ...newUnique];
                            // Play sound if there's a new incoming message
                            const hasNewIncoming = newUnique.some((m: Message) => m.direction === 'incoming');
                            if (hasNewIncoming) {
                                playNotificationSound();
                            }
                            return updated;
                        });
                        scrollToBottom();
                    }
                } else {
                    // History load
                    if (offset === 0) {
                        // Initial load
                        setMessages(data.messages);
                        setHasMoreMessages(data.hasMore);
                        scrollToBottom();
                    } else {
                        // Load more (prepend)
                        if (data.messages.length > 0) {
                            setMessages(prev => {
                                const existingIds = new Set(prev.map(m => m.id));
                                const newUnique = data.messages.filter((m: Message) => !existingIds.has(m.id));
                                return [...newUnique, ...prev];
                            });
                            setHasMoreMessages(data.hasMore);
                        } else {
                            setHasMoreMessages(false);
                        }
                    }
                }
            } else {
                console.error('Error fetching messages:', data.error);
                if (afterId === 0 && offset === 0) setMessages([]);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
            if (afterId === 0 && offset === 0) setMessages([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const playNotificationSound = () => {
        // Only play sound if document is NOT focused
        if (document.hasFocus()) {
            return;
        }

        try {
            // Softer, more discrete beep
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Lower frequency (500Hz instead of 800Hz) for a softer tone
            oscillator.frequency.value = 500;
            oscillator.type = 'sine';

            // Lower volume and smoother envelope
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Start lower (0.1)
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3); // Faster decay

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('Could not play notification sound:', error);
        }
    };

    // Send message
    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedContact || sending) return;

        const messageToSend = newMessage; // Store for sending
        setNewMessage(''); // Clear immediately for better UX
        setSending(true);

        try {
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telefone: selectedContact.telefone,
                    message: messageToSend
                })
            });

            if (res.ok) {
                // Add message optimistically
                const optimisticMessage: Message = {
                    id: Date.now(),
                    direction: 'outgoing',
                    body: messageToSend,
                    timestamp: new Date().toISOString(),
                    status: 'sent',
                    media_url: null
                };
                setMessages(prev => [...prev, optimisticMessage]);

                // Clear unread count for this contact locally
                setContacts(prev => prev.map(c => {
                    if (c.cpf === selectedContact.cpf) {
                        return { ...c, unread_count: 0 };
                    }
                    return c;
                }));
            } else {
                const errorData = await res.json();
                console.error('Failed to send message. Status:', res.status, 'Error:', errorData);
                toastError(errorData.error || 'Falha ao enviar mensagem');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            toastError('Erro ao enviar mensagem');
        } finally {
            setSending(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedContact) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await fetch('/api/chat/upload', {
                method: 'POST',
                body: formData
            });
            const uploadData = await uploadRes.json();

            if (uploadData.success) {
                // Send message with media
                const res = await fetch('/api/chat/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telefone: selectedContact.telefone,
                        message: file.name, // Use filename as caption/message
                        mediaUrl: uploadData.url,
                        mediaType: uploadData.type
                    })
                });

                if (res.ok) {
                    // Optimistic update
                    const optimisticMessage: Message = {
                        id: Date.now(),
                        direction: 'outgoing',
                        body: file.name,
                        timestamp: new Date().toISOString(),
                        status: 'sent',
                        media_url: uploadData.url,
                        media_type: file.type.startsWith('image') ? 'image' :
                            file.type.startsWith('audio') ? 'audio' :
                                file.type.startsWith('video') ? 'video' : 'document'
                    };
                    setMessages(prev => [...prev, optimisticMessage]);
                    setContacts(prev => prev.map(c => {
                        if (c.cpf === selectedContact.cpf) {
                            return { ...c, unread_count: 0 };
                        }
                        return c;
                    }));
                }
            }
        } catch (error) {
            console.error('Error uploading/sending file:', error);
            toastError('Erro ao enviar arquivo');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            toastError('Erro ao acessar o microfone. Verifique as permissões.');
        }
    };

    const handleStopRecording = async (send: boolean) => {
        if (!mediaRecorderRef.current || !selectedContact) return;

        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsRecording(false);

        if (!send) {
            audioChunksRef.current = [];
            return; // Cancelled
        }

        // Wait a bit for the last chunk
        setTimeout(async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });

            setIsUploading(true);
            try {
                const formData = new FormData();
                formData.append('file', audioFile);

                const uploadRes = await fetch('/api/chat/upload', {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await uploadRes.json();

                if (uploadData.success) {
                    // Send message with media
                    const res = await fetch('/api/chat/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            telefone: selectedContact.telefone,
                            message: 'Áudio gravado',
                            mediaUrl: uploadData.url,
                            mediaType: 'audio'
                        })
                    });

                    if (res.ok) {
                        // Optimistic update
                        const optimisticMessage: Message = {
                            id: Date.now(),
                            direction: 'outgoing',
                            body: 'Áudio gravado',
                            timestamp: new Date().toISOString(),
                            status: 'sent',
                            media_url: uploadData.url,
                            media_type: 'audio'
                        };
                        setMessages(prev => [...prev, optimisticMessage]);
                    }
                }
            } catch (error) {
                console.error('Error uploading/sending audio:', error);
            } finally {
                setIsUploading(false);
            }
        }, 200);
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const scrollToBottom = () => {
        // Only scroll to bottom if we are NOT loading more history
        if (!prevScrollHeightRef.current) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget;
        // Use a threshold (e.g., 50px) instead of exactly 0 to make it easier to trigger
        if (container.scrollTop < 50 && !loadingMore && hasMoreMessages && selectedContact) {
            setLoadingMore(true);
            // Capture current scroll height before loading more
            prevScrollHeightRef.current = container.scrollHeight;

            // Load more messages
            fetchMessages(selectedContact.cpf, true, 0, messages.length);
        }
    };

    // Restore scroll position after loading more messages
    useEffect(() => {
        if (prevScrollHeightRef.current !== null && messagesContainerRef.current) {
            const container = messagesContainerRef.current;
            const newScrollHeight = container.scrollHeight;
            const diff = newScrollHeight - prevScrollHeightRef.current;

            // Restore scroll position to maintain user's view
            container.scrollTop = diff;

            // Reset ref
            prevScrollHeightRef.current = null;
        }
    }, [messages]);

    useEffect(() => {
        // Initial fetch only - WebSocket handles real-time updates
        fetchContacts();

        // Load commercial settings
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.comercialPhone) setComercialPhone(data.comercialPhone);
                if (data.comercialName) setComercialName(data.comercialName);
            });

        // No periodic polling - WebSocket handles updates
    }, []);

    const syncProfilePic = async (contact: Contact) => {
        if (contact.profile_image) return; // Already has one

        try {
            const res = await fetch('/api/whatsapp/sync-profile-pic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: contact.telefone, cpf: contact.cpf })
            });
            const data = await res.json();
            if (data.success && data.profile_image) {
                // Update local state
                setContacts(prev => prev.map(c => {
                    if (c.cpf === contact.cpf) {
                        return { ...c, profile_image: data.profile_image };
                    }
                    return c;
                }));
                // Also update selected contact if it's still the same
                if (selectedContact?.cpf === contact.cpf) {
                    setSelectedContact(prev => prev ? { ...prev, profile_image: data.profile_image } : null);
                }
            }
        } catch (error) {
            console.error('Error syncing profile pic:', error);
        }
    };

    const handleSyncHistory = async (cpf: string, limit = 30) => {
        setSyncing(true);
        try {
            const res = await fetch('/api/whatsapp/sync-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpf, limit })
            });

            if (res.ok) {
                // Refresh messages after sync
                // We don't need to do anything special here because the poller or next fetch will pick it up
                // But for immediate feedback, we can re-fetch the initial batch
                await fetchMessages(cpf, false, 0, 0);
            }
        } catch (error) {
            console.error('Error syncing history:', error);
        } finally {
            setSyncing(false);
        }
    };

    // Removed useEffect for scrollToBottom on messages change to avoid auto-scrolling when loading more
    // We only scroll to bottom on initial load or new message sent/received (handled in fetchMessages)

    // Handle new messages via WebSocket
    const handleNewSocketMessage = useCallback((message: Message) => {
        console.log('[Chat] WebSocket: Nova mensagem recebida', message);

        setMessages(prev => {
            // Check if message already exists (deduplication)
            const exists = prev.some(m => m.id === message.id);
            if (exists) return prev;

            const updated = [...prev, message];

            // Play sound for incoming messages
            if (message.direction === 'incoming') {
                playNotificationSound();
            }

            return updated;
        });

        scrollToBottom();
    }, []);

    // Use WebSocket for real-time messages
    useSocketMessages({
        contactCpf: selectedContact?.cpf || null,
        onNewMessage: handleNewSocketMessage,
        enabled: !!selectedContact
    });

    // Use WebSocket for contact updates (unread count, last message, etc)
    const handleContactUpdate = useCallback((data: any) => {
        console.log('[Chat] Contact update received via Socket:', data);
        setContacts(prev => prev.map(c => {
            if (c.cpf === data.cpf) {
                return {
                    ...c,
                    ...data.updates,
                    // Handle special case for unread_count increment
                    unread_count: data.updates.unread_count === -1
                        ? (c.unread_count || 0) + 1
                        : (data.updates.unread_count ?? c.unread_count)
                };
            }
            return c;
        }));
    }, []);

    useSocketContacts({
        onContactUpdated: handleContactUpdate,
        enabled: true
    });

    useEffect(() => {
        if (selectedContact) {
            setMessages([]);
            setHasMoreMessages(true);

            console.log(`[Chat] Contato selecionado: ${selectedContact.nome}`);

            // Initial fetch from DB
            fetchMessages(selectedContact.cpf, false, 0, 0);

            // Auto-sync last 30 messages
            handleSyncHistory(selectedContact.cpf, 30);

            // Try to sync profile pic if missing
            syncProfilePic(selectedContact);

            // WebSocket handles real-time updates now
            // Only use polling as fallback if WebSocket is not connected
            let fallbackInterval: NodeJS.Timeout | null = null;

            if (!socketConnected) {
                console.log('[Chat] WebSocket not connected, using fallback polling');
                fallbackInterval = setInterval(() => {
                    setMessages(currentMessages => {
                        const lastId = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].id : 0;
                        fetchMessages(selectedContact.cpf, true, lastId);
                        return currentMessages;
                    });
                }, 5000); // 5 seconds fallback (less aggressive than before)
            }

            // Safety net: Periodic sync every 5 minutes to catch any edge cases
            const syncInterval = setInterval(() => {
                console.log(`[Chat] Safety sync para ${selectedContact.nome}`);
                handleSyncHistory(selectedContact.cpf, 50);
            }, 300000); // 5 minutes

            return () => {
                if (fallbackInterval) clearInterval(fallbackInterval);
                clearInterval(syncInterval);
            };
        }
    }, [selectedContact, socketConnected, handleNewSocketMessage]);

    // Calculate filter counts
    const unansweredCount = contacts.filter(c => c.last_message_direction === 'incoming').length;
    const unreadCount = contacts.filter(c => c.unread_count > 0).length;
    const statusCounts = statuses.reduce((acc, s) => {
        acc[s.name] = contacts.filter(c => c.status?.toLowerCase() === s.name.toLowerCase()).length;
        return acc;
    }, {} as Record<string, number>);

    // Filtered contacts with all filters applied
    const filteredContacts = contacts.filter(c => {
        // Text search
        const matchesSearch = searchQuery === '' ||
            c.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.telefone.includes(searchQuery);

        // Unanswered filter
        const matchesUnanswered = !showUnanswered || c.last_message_direction === 'incoming';

        // Unread filter
        const matchesUnread = !showUnread || c.unread_count > 0;

        // Status filter
        const matchesStatus = selectedStatuses.length === 0 ||
            selectedStatuses.some(s => s.toLowerCase() === c.status?.toLowerCase());

        return matchesSearch && matchesUnanswered && matchesUnread && matchesStatus;
    });

    const hasActiveFilters = showUnanswered || showUnread || selectedStatuses.length > 0;

    const clearFilters = () => {
        setShowUnanswered(false);
        setShowUnread(false);
        setSelectedStatuses([]);
    };

    const handleForwardToComercial = async () => {
        if (!selectedContact || !comercialPhone) {
            return;
        }

        setForwarding(true);
        try {
            // API forward agora envia mensagem e registra na timeline
            const res = await fetch('/api/forward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cpf: selectedContact.cpf,
                    comercialPhone: comercialPhone,
                    comercialName: comercialName || 'Comercial'
                })
            });

            if (res.ok) {
                toastSuccess('Lead encaminhado para o comercial!');
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
        } finally {
            setForwarding(false);
        }
    };

    const formatTime = (timestamp: string) => {
        // SQLite timestamps are in format "YYYY-MM-DD HH:MM:SS" without timezone info
        // They are stored in UTC, so we need to explicitly treat them as UTC
        // Add 'Z' to indicate UTC if not already in ISO format
        const utcTimestamp = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T') + 'Z';
        const date = new Date(utcTimestamp);

        return date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
        });
    };

    // Get status color for avatar border/background
    const getStatusColor = (status: string) => {
        const statusLower = status?.toLowerCase() || '';
        if (statusLower === 'inscrito') return '#3b82f6';
        if (statusLower === 'aprovado') return '#FFB74D'; // Laranja claro
        if (statusLower === 'matriculado') return '#16a34a';
        if (statusLower === 'novo') return '#4b5563';
        if (statusLower === 'pendente') return '#c2410c';
        if (statusLower === 'cancelado') return '#dc2626';
        if (statusLower === 'interessado') return '#0284c7';
        if (statusLower === 'lead') return '#7e22ce';
        return '#25d366'; // Default WhatsApp green
    };

    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Hoje';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Ontem';
        }
        return date.toLocaleDateString('pt-BR');
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    <RefreshCw className={styles.spin} size={32} />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Sidebar */}
            <div className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <div className={styles.searchBox}>
                        <Search size={16} className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Pesquisar contato..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                </div>

                {/* Filter Area */}
                <div className={styles.filterArea}>
                    {/* Quick Filters */}
                    <div className={styles.quickFilters}>
                        <button
                            className={`${styles.filterTab} ${showUnread ? styles.active : ''}`}
                            onClick={() => setShowUnread(!showUnread)}
                        >
                            <span>Novas</span>
                            {unreadCount > 0 && (
                                <span className={styles.filterBadge}>{unreadCount}</span>
                            )}
                        </button>
                        <button
                            className={`${styles.filterTab} ${showUnanswered ? styles.active : ''} ${styles.urgent}`}
                            onClick={() => setShowUnanswered(!showUnanswered)}
                        >
                            <span>Não Respondidas</span>
                            {unansweredCount > 0 && (
                                <span className={`${styles.filterBadge} ${styles.urgentBadge}`}>
                                    {unansweredCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Status Chips */}
                    <div className={styles.statusChips}>
                        {statuses.map(status => (
                            <button
                                key={status.id}
                                className={`${styles.statusChip} ${selectedStatuses.includes(status.name) ? styles.active : ''}`}
                                onClick={() => {
                                    setSelectedStatuses(prev =>
                                        prev.includes(status.name)
                                            ? prev.filter(s => s !== status.name)
                                            : [...prev, status.name]
                                    );
                                }}
                                style={{
                                    '--chip-color': status.color,
                                    '--chip-bg': `${status.color}20`,
                                } as React.CSSProperties}
                            >
                                <span className={styles.chipDot} style={{ backgroundColor: status.color }} />
                                <span>{status.name}</span>
                                {statusCounts[status.name] > 0 && (
                                    <span className={styles.chipCount}>{statusCounts[status.name]}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                        <button className={styles.clearFilters} onClick={clearFilters}>
                            <X size={14} />
                            <span>Limpar filtros</span>
                        </button>
                    )}
                </div>

                <div className={styles.contactList}>
                    {filteredContacts.map((contact) => (
                        <div
                            key={contact.cpf}
                            className={`${styles.contactItem} ${selectedContact?.cpf === contact.cpf ? styles.active : ''}`}
                            onClick={() => setSelectedContact(contact)}
                        >
                            <div
                                className={styles.avatar}
                                style={{
                                    backgroundImage: contact.profile_image ? `url(${contact.profile_image})` : 'none',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    backgroundColor: contact.profile_image ? 'transparent' : getStatusColor(contact.status),
                                    border: `3px solid ${getStatusColor(contact.status)}`,
                                    color: contact.profile_image ? 'transparent' : 'white'
                                }}
                            >
                                {!contact.profile_image && contact.nome.charAt(0).toUpperCase()}
                            </div>
                            <div className={styles.contactInfo}>
                                <div className={styles.contactName}>
                                    {contact.nome}
                                    {contact.unread_count > 0 && (
                                        <span className={styles.unreadBadge}>Novo</span>
                                    )}
                                </div>
                                <div className={styles.contactMeta}>
                                    <span className={styles.statusBadge}>{contact.status}</span>
                                    {contact.tipo_ingresso && (
                                        <span className={styles.semesterText}> • {contact.tipo_ingresso}</span>
                                    )}
                                </div>
                                {contact.last_message && (
                                    <div className={styles.lastMessage}>
                                        {contact.last_message_direction === 'outgoing' && 'Você: '}
                                        {contact.last_message.substring(0, 30)}
                                        {contact.last_message.length > 30 && '...'}
                                    </div>
                                )}
                            </div>
                            {contact.last_message_time && (
                                <div className={styles.messageTime}>
                                    {formatTime(contact.last_message_time)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className={styles.chatArea}>
                {selectedContact ? (
                    <>
                        <div className={styles.chatHeader}>
                            <div
                                className={styles.avatar}
                                style={{
                                    backgroundImage: selectedContact.profile_image ? `url(${selectedContact.profile_image})` : 'none',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    backgroundColor: selectedContact.profile_image ? 'transparent' : getStatusColor(selectedContact.status),
                                    border: `3px solid ${getStatusColor(selectedContact.status)}`,
                                    color: selectedContact.profile_image ? 'transparent' : 'white'
                                }}
                            >
                                {!selectedContact.profile_image && selectedContact.nome.charAt(0).toUpperCase()}
                            </div>
                            <div className={styles.chatHeaderInfo}>
                                <h3>{selectedContact.nome}</h3>
                                <p>
                                    {selectedContact.telefone}
                                </p>
                            </div>
                            {comercialPhone && (
                                <button
                                    className={styles.refreshButton}
                                    onClick={handleForwardToComercial}
                                    title={`Encaminhar para ${comercialName || 'Comercial'}`}
                                    disabled={forwarding}
                                    style={{ marginRight: '0.25rem' }}
                                >
                                    <Forward size={18} className={forwarding ? styles.spin : ''} />
                                </button>
                            )}
                            <button
                                className={styles.refreshButton}
                                onClick={() => {
                                    console.log('[Chat] Refresh manual disparado');
                                    handleSyncHistory(selectedContact.cpf, 50);
                                    fetchMessages(selectedContact.cpf, false, 0, 0);
                                }}
                                title="Atualizar mensagens"
                                disabled={syncing}
                            >
                                <RefreshCw size={18} className={syncing ? styles.spin : ''} />
                            </button>
                            {syncing && (
                                <div className={styles.syncingIndicator} title="Sincronizando...">
                                    <RefreshCw className={styles.spin} size={16} />
                                </div>
                            )}
                        </div>

                        <div
                            className={styles.messagesContainer}
                            ref={messagesContainerRef}
                            onScroll={handleScroll}
                        >
                            {loadingMore && (
                                <div className={styles.loadingMore}>
                                    <RefreshCw className={styles.spin} size={20} />
                                </div>
                            )}
                            <div className={styles.messagesList}>
                                {messages.map((msg, index) => (
                                    <div key={msg.id} className={`${styles.message} ${styles[msg.direction]}`}>
                                        <div className={styles.messageBubble}>
                                            {msg.media_url && (
                                                <div className={styles.mediaContent}>
                                                    {(msg.media_type === 'image' || (!msg.media_type && msg.media_url.match(/\.(jpeg|jpg|gif|png)$/i))) ? (
                                                        <img
                                                            src={msg.media_url}
                                                            alt="Media"
                                                            className={styles.messageImage}
                                                            onClick={() => window.open(msg.media_url!, '_blank')}
                                                        />
                                                    ) : (msg.media_type === 'audio' || (!msg.media_type && msg.media_url.match(/\.(mp3|ogg|wav)$/i))) ? (
                                                        <audio controls src={msg.media_url} className={styles.messageAudio} />
                                                    ) : (msg.media_type === 'video' || (!msg.media_type && msg.media_url.match(/\.(mp4|webm)$/i))) ? (
                                                        <video controls src={msg.media_url} className={styles.messageVideo} />
                                                    ) : (
                                                        <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                                                            <FileText size={20} />
                                                            <span>{msg.body || 'Arquivo'}</span>
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                            <div className={styles.messageBody}>{msg.body}</div>
                                            <div className={styles.messageFooter}>
                                                {formatTime(msg.timestamp)}
                                                {msg.direction === 'outgoing' && (
                                                    <span className={styles.statusIcon} title={msg.status}>
                                                        {msg.status === 'read' || msg.status === 'played' ? (
                                                            <CheckCheck size={14} color="#3b82f6" />
                                                        ) : msg.status === 'delivered' ? (
                                                            <CheckCheck size={14} color="#9ca3af" />
                                                        ) : (
                                                            <Check size={14} color="#9ca3af" />
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        <div className={styles.messageInput}>
                            <input
                                type="text"
                                className={styles.inputField}
                                placeholder="Digite uma mensagem..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                disabled={sending}
                            />
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                            />
                            <button
                                className={styles.attachButton}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={sending || isUploading}
                                title="Anexar arquivo"
                            >
                                {isUploading ? <RefreshCw className={styles.spin} size={20} /> : <Paperclip size={20} />}
                            </button>
                            <button
                                className={styles.sendButton}
                                onClick={handleSendMessage}
                                disabled={!newMessage.trim() || sending}
                            >
                                {sending ? <RefreshCw className={styles.spin} size={20} /> : <Send size={20} />}
                            </button>

                            {isRecording ? (
                                <div className={styles.recordingControls}>
                                    <div className={styles.recordingIndicator}>
                                        <div className={styles.recordingDot}></div>
                                        <span>{formatDuration(recordingTime)}</span>
                                    </div>
                                    <button
                                        className={styles.cancelRecordButton}
                                        onClick={() => handleStopRecording(false)}
                                        title="Cancelar"
                                    >
                                        <X size={20} />
                                    </button>
                                    <button
                                        className={styles.stopRecordButton}
                                        onClick={() => handleStopRecording(true)}
                                        title="Enviar Áudio"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className={styles.micButton}
                                    onClick={handleStartRecording}
                                    disabled={sending || isUploading || !!newMessage.trim()}
                                    title="Gravar áudio"
                                >
                                    <Mic size={20} />
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className={styles.emptyState}>
                        <MessageCircle size={80} />
                        <h2>Suas conversas no CRM</h2>
                        <p>Selecione um contato para iniciar a conversa via WhatsApp</p>
                    </div>
                )}
            </div>
        </div>
    );
}

