'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
// import styles from './YCloudTemplates.module.css'; 

interface YCloudTemplate {
    id: number;
    template_name: string;
    friendly_name: string;
    category: string;
    language: string;
    status: 'draft' | 'pending' | 'approved' | 'rejected';
    ycloud_template_id: string | null;
    rejection_reason: string | null;
}

export default function YCloudTemplatesTable() {
    const { success, error } = useToast();
    const [templates, setTemplates] = useState<YCloudTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const fetchTemplates = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/ycloud/templates');
            const data = await res.json();
            if (res.ok) {
                setTemplates(data);
            } else {
                error(data.error || 'Erro ao carregar templates');
            }
        } catch (e) {
            console.error(e);
            error('Erro de conexão');
        } finally {
            setLoading(false);
        }
    }, [error]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            // First sync full list
            const res1 = await fetch('/api/ycloud/templates/sync', { method: 'POST' });

            // Then check statuses of pending items (optional, but good for completeness)
            const res2 = await fetch('/api/ycloud/templates/sync-status', { method: 'POST' });

            if (res1.ok && res2.ok) {
                success('Templates sincronizados com sucesso!');
                fetchTemplates();
            } else {
                error('Erro parcial na sincronização');
            }
        } catch (e) {
            console.error(e);
            error('Erro ao sincronizar');
        } finally {
            setSyncing(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14} /> Aprovado</span>;
            case 'pending':
                return <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> Em Análise</span>;
            case 'rejected':
                return <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={14} /> Rejeitado</span>;
            case 'draft':
            default:
                return <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> Rascunho</span>;
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <p style={{ color: '#64748b' }}>
                    Templates sincronizados com a API Oficial (YCloud). Necessário para iniciar conversas (HSM).
                </p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #e2e8f0',
                            background: 'white',
                            cursor: syncing ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar'}
                    </button>
                    {/* Add New Template button would go here */}
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Carregando...</div>
            ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Nome Amigável</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Nome API (ID)</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Categoria</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Idioma</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody style={{ background: 'white' }}>
                            {templates.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                        Nenhum template encontrado. Clique em Sincronizar.
                                    </td>
                                </tr>
                            ) : (
                                templates.map(t => (
                                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.75rem 1rem', color: '#0f172a', fontWeight: 500 }}>{t.friendly_name}</td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#475569', fontFamily: 'monospace' }}>{t.template_name}</td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{t.category}</td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{t.language}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            {getStatusBadge(t.status)}
                                            {t.rejection_reason && (
                                                <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '2px' }}>
                                                    {t.rejection_reason}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
