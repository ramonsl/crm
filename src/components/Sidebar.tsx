'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, MessageSquare, MessageCircle, Settings, LogOut, Upload, Columns, FileText, UserPlus, X, Bot, Zap } from 'lucide-react';
import styles from './Sidebar.module.css';
import { useEffect, useState } from 'react';

interface SidebarProps {
    isOpen?: boolean;
    onToggle?: () => void;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const [waStatus, setWaStatus] = useState<'disconnected' | 'initializing' | 'ready'>('disconnected');

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/whatsapp');
                const data = await res.json();
                setWaStatus(data.status);
            } catch (error) {
                console.error(error);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, []);

    const links = [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/contacts', label: 'Inscritos', icon: Users },
        { href: '/kanban', label: 'Kanban', icon: Columns },
        { href: '/chat', label: 'Chat', icon: MessageCircle },
        { href: '/whatsapp-chat', label: 'WhatsApp Chat', icon: MessageSquare, badge: 'POC' },
        { href: '/auto-replies', label: 'Auto-Respostas', icon: Bot },
        { href: '/templates', label: 'Modelos', icon: FileText },
        { href: '/automation', label: 'Automação', icon: Zap },
        { href: '/import', label: 'Importar', icon: Upload },
        { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare, showStatus: true },
        { href: '/settings', label: 'Configurações', icon: Settings },
    ];

    return (
        <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
            <div className={styles.logoContainer}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className={styles.logoIcon}>C</div>
                    <span className={styles.logoText}>Coordena+</span>
                </div>
                {/* Mobile Close Button */}
                <button
                    className={styles.closeButton}
                    onClick={onToggle}
                    aria-label="Close sidebar"
                >
                    <X size={20} />
                </button>
            </div>

            <nav className={styles.nav}>
                <p className={styles.sectionTitle}>MENU PRINCIPAL</p>
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`${styles.link} ${isActive ? styles.active : ''}`}
                        >
                            <div className={styles.iconWrapper}>
                                <Icon size={20} />
                                {link.showStatus && (
                                    <span className={styles.statusDot} style={{
                                        background: waStatus === 'ready' ? '#10b981' : '#ef4444',
                                        boxShadow: waStatus === 'ready' ? '0 0 8px #10b981' : 'none'
                                    }} />
                                )}
                            </div>
                            <span className={styles.linkLabel}>
                                {link.label}
                                {link.badge && (
                                    <span className={styles.badge}>{link.badge}</span>
                                )}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            <div className={styles.footer}>
                <button className={styles.logoutButton}>
                    <LogOut size={20} />
                    <span>Sair</span>
                </button>
            </div>
        </aside>
    );
}
