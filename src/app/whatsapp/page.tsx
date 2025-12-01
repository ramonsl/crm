'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { QrCode, RefreshCw, Smartphone, CheckCircle, AlertCircle, Terminal, Send } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useToast } from '@/contexts/ToastContext';

export default function WhatsAppPage() {
    const { success: toastSuccess, error: toastError } = useToast();
    const [status, setStatus] = useState<'disconnected' | 'initializing' | 'ready'>('disconnected');
    const [qrCode, setQrCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [queueState, setQueueState] = useState<any>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/whatsapp');
            const data = await res.json();
            setStatus(data.status);
            setQrCode(data.qrCode || '');
        } catch (error) {
            console.error(error);
        }
    };

    const fetchQueueState = async () => {
        try {
            const res = await fetch('/api/whatsapp/queue');
            const data = await res.json();
            setQueueState(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        checkStatus();
        fetchQueueState();
        const interval = setInterval(() => {
            checkStatus();
            fetchQueueState();
        }, 2000); // Poll every 2s for smoother UI
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [queueState?.logs]);

    const handleConnect = async () => {
        setLoading(true);
        try {
            await fetch('/api/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'connect' })
            });
            // Poll immediately after action
            setTimeout(checkStatus, 1000);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/whatsapp', {
                method: 'DELETE',
            });
            const data = await res.json();
            if (res.ok) {
                setStatus('disconnected');
                setQrCode('');
                // Force status check
                await checkStatus();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleTestMessage = async () => {
        const defaultPhone = '51981636027';
        const phone = prompt('Digite o número para teste (ex: 5551999999999):', defaultPhone);
        if (!phone) return;

        try {
            const res = await fetch('/api/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send',
                    phone: phone,
                    message: 'Teste de conexão CRM'
                })
            });

            const data = await res.json();

            if (res.ok) {
                toastSuccess('Mensagem de teste enviada!');
            } else {
                toastError(`Erro ao enviar teste: ${data.error || 'Erro desconhecido'}`);
            }
        } catch (error) {
            console.error(error);
            toastError('Erro de conexão com o servidor');
        }
    };

    const handleReset = async () => {
        if (!confirm('Isso irá desconectar e apagar completamente a sessão atual. Você precisará clicar em "Conectar WhatsApp" novamente. Continuar?')) return;

        setLoading(true);
        try {
            const res = await fetch('/api/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset' })
            });
            if (res.ok) {
                setStatus('disconnected');
                setQrCode('');
                toastSuccess('Sessão resetada e desconectada com sucesso.');
                // Force status check
                await checkStatus();
            }
        } catch (error) {
            console.error(error);
            toastError('Erro ao resetar sessão.');
        } finally {
            setLoading(false);
        }
    };

    const handleClearQueue = async () => {
        if (!confirm('Tem certeza que deseja limpar toda a fila de mensagens?')) return;

        setLoading(true);
        try {
            const res = await fetch('/api/whatsapp/queue', {
                method: 'DELETE'
            });
            if (res.ok) {
                toastSuccess('Fila limpa com sucesso!');
                fetchQueueState();
            } else {
                toastError('Erro ao limpar fila.');
            }
        } catch (error) {
            console.error(error);
            toastError('Erro ao limpar fila.');
        } finally {
            setLoading(false);
        }
    };

    // Calculate progress
    const total = queueState?.stats?.total || 0;
    const processed = queueState?.stats?.processed || 0;
    const failed = queueState?.stats?.failed || 0;
    const progress = total > 0 ? ((processed + failed) / total) * 100 : 0;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>WhatsApp Connection</h1>
                    <p className={styles.subtitle}>Gerencie sua conexão e fila de mensagens</p>
                </div>
                <div className={styles.statusBadge}>
                    <div className={`${styles.statusDot} ${styles[status]}`} />
                    <span>
                        {status === 'ready' ? 'Conectado' :
                            status === 'initializing' ? 'Inicializando...' : 'Desconectado'}
                    </span>
                </div>
            </header>

            <div className={styles.grid}>
                {/* Connection Card */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3>Status da Conexão</h3>
                    </div>
                    <div className={styles.cardBody}>
                        {status === 'ready' ? (
                            <div className={styles.connectedState}>
                                <div className={styles.iconCircle}>
                                    <CheckCircle size={48} color="#10b981" />
                                </div>
                                <h3>WhatsApp Conectado</h3>
                                <p>O sistema está pronto para enviar mensagens.</p>

                                <div className={styles.actions}>
                                    <button
                                        onClick={handleDisconnect}
                                        className={styles.disconnectButton}
                                        disabled={loading}
                                    >
                                        {loading ? 'Processando...' : 'Desconectar'}
                                    </button>
                                    <button
                                        onClick={handleTestMessage}
                                        className={styles.testButton}
                                        disabled={loading}
                                    >
                                        <Send size={16} />
                                        Enviar Teste
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className={styles.disconnectButton}
                                        style={{ backgroundColor: '#dc2626' }}
                                        disabled={loading}
                                        title="Apagar sessão e reiniciar"
                                    >
                                        <RefreshCw size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.disconnectedState}>
                                {qrCode ? (
                                    <div className={styles.qrContainer}>
                                        <div style={{ background: 'white', padding: '16px' }}>
                                            <QRCode value={qrCode} size={256} />
                                        </div>
                                        <p>Escaneie o QR Code com seu WhatsApp</p>
                                    </div>
                                ) : (
                                    <div className={styles.placeholderState}>
                                        <Smartphone size={48} className={styles.placeholderIcon} />
                                        <p>Clique em conectar para gerar o QR Code</p>
                                    </div>
                                )}

                                <div className={styles.actions}>
                                    {status === 'initializing' ? (
                                        <button
                                            onClick={handleDisconnect}
                                            className={styles.disconnectButton}
                                            disabled={loading}
                                        >
                                            Cancelar
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleConnect}
                                            className={styles.connectButton}
                                            disabled={loading}
                                        >
                                            {loading ? 'Iniciando...' : 'Conectar WhatsApp'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Queue & Terminal Card */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3>Logs do WhatsApp</h3>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {queueState?.processing && <span className={styles.processingBadge}>Processando...</span>}
                            <button
                                onClick={handleClearQueue}
                                className={styles.secondaryButton}
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                title="Limpar fila de mensagens"
                                disabled={loading || queueState?.queueLength === 0}
                            >
                                Limpar Fila
                            </button>
                        </div>
                    </div>
                    <div className={styles.cardBody}>
                        {/* Progress Bar */}
                        <div className={styles.progressContainer}>
                            <div className={styles.progressInfo}>
                                <span>Progresso Total</span>
                                <span>{processed + failed} / {total}</span>
                            </div>
                            <div className={styles.progressBarTrack}>
                                <div
                                    className={styles.progressBarFill}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* Terminal */}
                        <div className={styles.terminal}>
                            <div className={styles.terminalHeader}>
                                <Terminal size={14} />
                                <span>Terminal de Logs</span>
                            </div>
                            <div className={styles.terminalContent}>
                                {queueState?.logs?.length === 0 && (
                                    <div className={styles.logLine}>Aguardando tarefas...</div>
                                )}
                                {queueState?.logs?.slice().reverse().map((log: any, i: number) => (
                                    <div key={i} className={`${styles.logLine} ${styles[log.type]}`}>
                                        <span className={styles.timestamp}>
                                            [{new Date(log.timestamp).toLocaleTimeString()}]
                                        </span>
                                        {log.message}
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
