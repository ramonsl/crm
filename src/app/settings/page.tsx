'use client';

import { useState } from 'react';
import styles from './page.module.css';
import { Sliders, Palette, Plug, Database, Briefcase } from 'lucide-react';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { StatusSettings } from '@/components/settings/StatusSettings';
import { DataSettings } from '@/components/settings/DataSettings';
import { YCloudSettings } from '@/components/settings/YCloudSettings';
import { LinkedInSettings } from '@/components/settings/LinkedInSettings';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'general' | 'status' | 'integrations' | 'linkedin' | 'data'>('general');

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Configurações</h1>
                <p className={styles.subtitle}>Gerencie as preferências e integrações do sistema</p>
            </div>

            <div className={styles.tabsContainer}>
                <button
                    className={`${styles.tab} ${activeTab === 'general' ? styles.active : ''}`}
                    onClick={() => setActiveTab('general')}
                >
                    <Sliders size={18} />
                    Geral
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'status' ? styles.active : ''}`}
                    onClick={() => setActiveTab('status')}
                >
                    <Palette size={18} />
                    Status
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'integrations' ? styles.active : ''}`}
                    onClick={() => setActiveTab('integrations')}
                >
                    <Plug size={18} />
                    Integrações
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'linkedin' ? styles.active : ''}`}
                    onClick={() => setActiveTab('linkedin')}
                >
                    <Briefcase size={18} />
                    LinkedIn
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'data' ? styles.active : ''}`}
                    onClick={() => setActiveTab('data')}
                >
                    <Database size={18} />
                    Dados
                </button>
            </div>

            <div className={styles.content}>
                {activeTab === 'general' && <GeneralSettings />}
                {activeTab === 'status' && <StatusSettings />}
                {activeTab === 'integrations' && <YCloudSettings />}
                {activeTab === 'linkedin' && <LinkedInSettings />}
                {activeTab === 'data' && <DataSettings />}
            </div>
        </div>
    );
}
