'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, MessageSquare, Settings, LogOut, Upload, FileText, X, Bot, Zap, BadgeCheck, DollarSign, Menu } from 'lucide-react';
import styles from './Sidebar.module.css';
import { useEffect, useState } from 'react';

interface SidebarProps {
    isOpen?: boolean;
    onToggle?: () => void;
    isMobile?: boolean; // New prop for layout context
}

export default function Sidebar({ isOpen, onToggle, isMobile = false }: SidebarProps) {
    const pathname = usePathname();
    const [waStatus, setWaStatus] = useState<'disconnected' | 'initializing' | 'ready'>('disconnected');
    const [yCloudConfigured, setYCloudConfigured] = useState(false);

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

        const checkYCloudConfig = async () => {
            try {
                const res = await fetch('/api/settings');
                const data = await res.json();
                // YCloud is configured if API key exists
                setYCloudConfigured(!!data.yCloudApiKey);
            } catch (error) {
                console.error(error);
            }
        };

        checkStatus();
        checkYCloudConfig();
        const interval = setInterval(checkStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    const links = [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/contacts', label: 'Inscritos', icon: Users },
        { href: '/whatsapp-chat', label: 'WhatsApp Chat', icon: MessageSquare, badge: 'POC' },
        { href: '/auto-replies', label: 'Auto-Respostas', icon: Bot },
        { href: '/templates', label: 'Modelos', icon: FileText },
        { href: '/automation', label: 'Automação', icon: Zap },
        { href: '/import', label: 'Importar', icon: Upload },
        { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare, showStatus: true, showYCloudBadge: true },
        { href: '/costs', label: 'Custos', icon: DollarSign },
        { href: '/usuarios', label: 'Usuários', icon: Users },
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
                <div className={styles.menuHeader}>
                    <p className={styles.sectionTitle}>MENU PRINCIPAL</p>
                    <button onClick={onToggle} className={styles.menuToggleButton}>
                        <Menu size={20} />
                    </button>
                </div>
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
                                {link.showYCloudBadge && yCloudConfigured && (
                                    <span title="YCloud Business API configurado">
                                        <BadgeCheck
                                            size={14}
                                            style={{
                                                marginLeft: '4px',
                                                color: '#0ea5e9',
                                                flexShrink: 0
                                            }}
                                        />
                                    </span>
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

