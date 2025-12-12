'use client';

import { Bell, Search, User, Menu } from 'lucide-react';
import styles from './Header.module.css';
import { useState, useEffect } from 'react';

interface HeaderProps {
    toggleSidebar: () => void;
    sidebarCollapsed: boolean;
}

export default function Header({ toggleSidebar, sidebarCollapsed }: HeaderProps) {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [waStatus, setWaStatus] = useState<'disconnected' | 'initializing' | 'ready'>('disconnected');
    const [waPhone, setWaPhone] = useState<string | null>(null);

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();
            setUnreadCount(data.total);
            setNotifications(data.notifications || []);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchWaStatus = async () => {
        try {
            const res = await fetch('/api/whatsapp');
            const data = await res.json();
            setWaStatus(data.status);
            setWaPhone(data.phoneNumber || null);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchWaStatus();
        const interval = setInterval(fetchWaStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (showNotifications) return;

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 5000);
        return () => clearInterval(interval);
    }, [showNotifications]);

    const handleToggleNotifications = () => {
        const newShow = !showNotifications;
        setShowNotifications(newShow);

        if (newShow && unreadCount > 0) {
            setUnreadCount(0); // Optimistic update
            fetch('/api/notifications', { method: 'PUT' }).catch(console.error);
        }
    };

    return (
        <header className={styles.header}>
            <div className={styles.leftSection}>
                <button className={styles.menuButton} onClick={toggleSidebar}>
                    <Menu size={24} />
                </button>

            </div>

            <div className={styles.rightSection}>
                {/* WhatsApp Status Indicator */}
                <div
                    title={waStatus === 'ready' ? `WhatsApp Conectado${waPhone ? `: +${waPhone}` : ''}` : "WhatsApp Desconectado"}
                    style={{
                        marginRight: 8,
                        cursor: 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0 8px',
                        height: '40px',
                        borderRadius: '20px',
                        background: waStatus === 'ready' ? 'rgba(34, 197, 94, 0.1)' : 'transparent'
                    }}
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill={waStatus === 'ready' ? '#22c55e' : '#9ca3af'}
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    {waStatus === 'ready' && waPhone && (
                        <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 500 }}>
                            +{waPhone}
                        </span>
                    )}
                </div>

                <div style={{ position: 'relative' }}>
                    <button
                        className={styles.iconButton}
                        onClick={handleToggleNotifications}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className={styles.notificationBadge}>{unreadCount}</span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className={styles.dropdown}>
                            <div className={styles.dropdownHeader}>
                                <span>Notificações</span>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{unreadCount} não lidas</span>
                            </div>
                            <div className={styles.dropdownList}>
                                {notifications.length > 0 ? (
                                    notifications.map((notif, index) => (
                                        <div key={index} className={styles.notificationItem}>
                                            <div className={styles.avatar} style={{ width: 32, height: 32, minWidth: 32, background: notif.source === 'system' ? 'var(--bg-body)' : undefined }}>
                                                {notif.source === 'system' ? '⚠️' : (notif.nome || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div className={styles.notificationContent}>
                                                <div className={styles.notificationName}>
                                                    {notif.source === 'system' ? notif.title : (notif.nome || 'Desconhecido')}
                                                </div>
                                                <div className={styles.notificationMessage}>
                                                    {notif.source === 'system' ? notif.message : notif.last_message}
                                                </div>
                                                {notif.source === 'system' && (
                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                                                        {new Date(notif.created_at).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                            {notif.unread_count > 0 && notif.source === 'chat' && (
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', marginTop: 6 }} />
                                            )}
                                            {notif.source === 'system' && (
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: notif.type === 'error' ? '#ef4444' : '#3b82f6', marginTop: 6 }} />
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className={styles.emptyState}>
                                        Nenhuma nova mensagem
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.profileDivider} />

                <div className={styles.profile}>
                    <div className={styles.avatar}>
                        <User size={20} />
                    </div>
                    <div className={styles.userInfo}>
                        <span className={styles.userName}>Usuário Admin</span>
                        <span className={styles.userRole}>Administrador</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
