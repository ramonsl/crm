/**
 * ContactsTabs - Tab navigation for different contact views
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Target, GraduationCap, UserX } from 'lucide-react';
import type { ContactView } from '@/types/contacts';
import styles from './ContactsTabs.module.css';

interface Tab {
    id: ContactView;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    description: string;
}

const TABS: Tab[] = [
    {
        id: 'all',
        label: 'Todos',
        icon: Users,
        description: 'Todos os contatos'
    },
    {
        id: 'leads',
        label: 'LEAD',
        icon: Target,
        description: 'Novos leads e em prospecção'
    },
    {
        id: 'inscritos',
        label: 'Inscritos',
        icon: GraduationCap,
        description: 'Todo o funil de inscrição'
    },
    {
        id: 'outros',
        label: 'Outros',
        icon: UserX,
        description: 'Outros status'
    }
];

interface ContactsTabsProps {
    activeView?: ContactView;
}

export function ContactsTabs({ activeView = 'all' }: ContactsTabsProps) {
    const pathname = usePathname();

    // Use activeView directly, parent handles the URL param
    const currentView = activeView;

    return (
        <div className={styles.tabsContainer}>
            <div className={styles.tabs}>
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = currentView === tab.id;

                    return (
                        <Link
                            key={tab.id}
                            href={`${pathname}?view=${tab.id}`}
                            className={`${styles.tab} ${isActive ? styles.active : ''}`}
                            title={tab.description}
                        >
                            <Icon size={18} className={styles.icon} />
                            <span className={styles.label}>{tab.label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
