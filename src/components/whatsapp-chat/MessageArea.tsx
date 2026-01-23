'use client';

/**
 * Message Area Component
 * 
 * Main area showing messages and input for selected chat.
 * Suporta: texto, emojis, imagens, áudio, documentos.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './MessageArea.module.css';
import { Send, Paperclip, Mic, MicOff, Smile, Loader2, Check, CheckCheck, Forward, X, Image, FileText, Play, Pause } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
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

interface UploadResult {
    success: boolean;
    url: string;
    mediaType: 'image' | 'video' | 'audio' | 'document';
    filename: string;
}

export default function MessageArea({ selectedChat, comercialPhone, comercialName, onForward, forwarding }: MessageAreaProps) {
    // State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Audio recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // WebSocket real-time messages
    const handleNewSocketMessage = useCallback((message: any) => {
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

        setMessages(prev => {
            const exists = prev.some(m => m.id === chatMessage.id);
            if (exists) return prev;
            return [...prev, chatMessage];
        });
    }, []);

    useSocketMessagesPhone({
        phone: selectedChat?.phone || null,
        onNewMessage: handleNewSocketMessage,
        enabled: !!selectedChat
    });

    // Effects
    useEffect(() => {
        if (selectedChat) {
            loadMessages();
            setShowEmojiPicker(false);
            setShowAttachMenu(false);
        }
    }, [selectedChat]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load messages
    const loadMessages = async () => {
        if (!selectedChat) return;
        try {
            setLoading(true);
            const url = `/api/whatsapp-chats/${encodeURIComponent(selectedChat.id)}/messages?limit=50`;
            const res = await fetch(url);
            const data = await res.json();
            if (res.ok) {
                setMessages(data.messages);
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

    // ========================================================================
    // MESSAGE SENDING
    // ========================================================================

    const sendMessage = async (text: string, mediaUrl?: string, mediaType?: string) => {
        if (!selectedChat) return;

        setSending(true);
        try {
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telefone: selectedChat.phone,
                    message: text || (mediaType ? `[${mediaType}]` : ''),
                    mediaUrl,
                    mediaType
                })
            });

            const data = await res.json();

            if (res.ok) {
                const newMsg: ChatMessage = {
                    id: data.messageId || `temp_${Date.now()}`,
                    body: text || `[${mediaType}]`,
                    fromMe: true,
                    timestamp: Math.floor(Date.now() / 1000),
                    hasMedia: !!mediaUrl,
                    mediaUrl: mediaUrl || null,
                    mediaType: mediaType as any || null,
                    status: 'sent',
                    ack: 1
                };
                setMessages(prev => [...prev, newMsg]);
                return true;
            } else {
                if (data.error === 'outside_window') {
                    alert(data.message || 'Janela de 24h fechada. É necessário usar um Template.');
                } else {
                    alert(`Erro ao enviar: ${data.error}`);
                }
                return false;
            }
        } catch (error) {
            console.error('[MessageArea] Send error:', error);
            alert('Erro ao enviar mensagem');
            return false;
        } finally {
            setSending(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        const text = newMessage.trim();
        setNewMessage('');
        await sendMessage(text);
    };

    // ========================================================================
    // EMOJI PICKER
    // ========================================================================

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setNewMessage(prev => prev + emojiData.emoji);
        inputRef.current?.focus();
    };

    // ========================================================================
    // FILE UPLOAD
    // ========================================================================

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setShowAttachMenu(false);
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await fetch('/api/chat/upload', {
                method: 'POST',
                body: formData
            });

            const uploadData: UploadResult = await uploadRes.json();

            if (!uploadData.success) {
                throw new Error('Upload failed');
            }

            // Send message with media
            await sendMessage(newMessage.trim(), uploadData.url, uploadData.mediaType);
            setNewMessage('');
        } catch (error) {
            console.error('Upload error:', error);
            alert('Erro ao enviar arquivo');
        } finally {
            setUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // ========================================================================
    // AUDIO RECORDING
    // ========================================================================

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                await uploadAndSendAudio(audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingDuration(0);

            // Start timer
            recordingIntervalRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Não foi possível acessar o microfone. Verifique as permissões.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        setIsRecording(false);
        setRecordingDuration(0);
        audioChunksRef.current = [];
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
        }
    };

    const uploadAndSendAudio = async (audioBlob: Blob) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', audioBlob, `audio_${Date.now()}.webm`);

            const uploadRes = await fetch('/api/chat/upload', {
                method: 'POST',
                body: formData
            });

            const uploadData: UploadResult = await uploadRes.json();

            if (uploadData.success) {
                await sendMessage('🎤 Áudio', uploadData.url, 'audio');
            }
        } catch (error) {
            console.error('Error uploading audio:', error);
            alert('Erro ao enviar áudio');
        } finally {
            setUploading(false);
            setRecordingDuration(0);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // ========================================================================
    // RENDER HELPERS
    // ========================================================================

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
        }
        return <Check size={16} className={styles.checkSent} />;
    };

    const renderMediaContent = (msg: ChatMessage) => {
        if (!msg.hasMedia || !msg.mediaUrl) {
            return <p className={styles.messageText}>{msg.body}</p>;
        }

        const mediaUrl = msg.mediaUrl.startsWith('http')
            ? msg.mediaUrl
            : msg.mediaUrl;

        switch (msg.mediaType) {
            case 'image':
                return (
                    <div className={styles.mediaContainer}>
                        <img
                            src={mediaUrl}
                            alt="Imagem"
                            className={styles.mediaImage}
                            onClick={() => window.open(mediaUrl, '_blank')}
                        />
                        {msg.body && msg.body !== '[image]' && (
                            <p className={styles.mediaCaption}>{msg.body}</p>
                        )}
                    </div>
                );
            case 'video':
                return (
                    <div className={styles.mediaContainer}>
                        <video
                            src={mediaUrl}
                            controls
                            className={styles.mediaVideo}
                        />
                        {msg.body && msg.body !== '[video]' && (
                            <p className={styles.mediaCaption}>{msg.body}</p>
                        )}
                    </div>
                );
            case 'audio':
                return (
                    <div className={styles.audioContainer}>
                        <audio src={mediaUrl} controls className={styles.audioPlayer} />
                    </div>
                );
            case 'document':
                return (
                    <a
                        href={mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.documentLink}
                    >
                        <FileText size={24} />
                        <span>{msg.body || 'Documento'}</span>
                    </a>
                );
            default:
                return <p className={styles.messageText}>{msg.body}</p>;
        }
    };

    // ========================================================================
    // RENDER
    // ========================================================================

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
                    <p>{selectedChat.phone || `Link ID: ${selectedChat.id.split('@')[0].substring(0, 12)}...`}</p>
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
                                    {renderMediaContent(msg)}
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

            {/* Emoji Picker */}
            {
                showEmojiPicker && (
                    <div className={styles.emojiPickerContainer}>
                        <EmojiPicker
                            onEmojiClick={handleEmojiClick}
                            theme={Theme.DARK}
                            width="100%"
                            height={350}
                            searchPlaceHolder="Buscar emoji..."
                        />
                    </div>
                )
            }

            {/* Attach Menu */}
            {
                showAttachMenu && (
                    <div className={styles.attachMenu}>
                        <button
                            className={styles.attachOption}
                            onClick={() => {
                                fileInputRef.current?.click();
                                fileInputRef.current?.setAttribute('accept', 'image/*,video/*');
                            }}
                        >
                            <Image size={24} />
                            <span>Imagem/Vídeo</span>
                        </button>
                        <button
                            className={styles.attachOption}
                            onClick={() => {
                                fileInputRef.current?.click();
                                fileInputRef.current?.setAttribute('accept', '.pdf,.doc,.docx,.xls,.xlsx,.txt');
                            }}
                        >
                            <FileText size={24} />
                            <span>Documento</span>
                        </button>
                    </div>
                )
            }

            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                onChange={handleFileSelect}
            />

            {/* Input Area */}
            <form className={styles.inputContainer} onSubmit={handleSendMessage}>
                {isRecording ? (
                    // Recording UI
                    <div className={styles.recordingContainer}>
                        <button
                            type="button"
                            className={styles.cancelRecording}
                            onClick={cancelRecording}
                        >
                            <X size={24} />
                        </button>
                        <div className={styles.recordingIndicator}>
                            <span className={styles.recordingDot}></span>
                            <span>{formatDuration(recordingDuration)}</span>
                        </div>
                        <button
                            type="button"
                            className={styles.sendButton}
                            onClick={stopRecording}
                        >
                            <Send size={24} />
                        </button>
                    </div>
                ) : (
                    // Normal Input
                    <>
                        <button
                            type="button"
                            className={`${styles.iconButton} ${showEmojiPicker ? styles.active : ''}`}
                            onClick={() => {
                                setShowEmojiPicker(!showEmojiPicker);
                                setShowAttachMenu(false);
                            }}
                            title="Emoji"
                        >
                            <Smile size={24} />
                        </button>
                        <button
                            type="button"
                            className={`${styles.iconButton} ${showAttachMenu ? styles.active : ''}`}
                            onClick={() => {
                                setShowAttachMenu(!showAttachMenu);
                                setShowEmojiPicker(false);
                            }}
                            title="Anexar"
                            disabled={uploading}
                        >
                            {uploading ? <Loader2 size={24} className="animate-spin" /> : <Paperclip size={24} />}
                        </button>

                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Digite uma mensagem"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onFocus={() => {
                                setShowEmojiPicker(false);
                                setShowAttachMenu(false);
                            }}
                            className={styles.messageInput}
                            disabled={sending || uploading}
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
                            <button
                                type="button"
                                className={styles.iconButton}
                                onClick={startRecording}
                                title="Gravar áudio"
                            >
                                <Mic size={24} />
                            </button>
                        )}
                    </>
                )}
            </form>
        </div>
    );
}
