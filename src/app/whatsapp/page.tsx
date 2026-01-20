'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { QrCode, RefreshCw, Smartphone, CheckCircle, AlertCircle, Terminal, Send, X, Cloud } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useToast } from '@/contexts/ToastContext';
import { useSocket } from '@/contexts/SocketContext';

export default function WhatsAppPage() {
    const { success: toastSuccess, error: toastError } = useToast();
    const [status, setStatus] = useState<'connecting' | 'ready' | 'qr' | 'disconnected'>('disconnected');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [queueState, setQueueState] = useState<any>(null);
    const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<'baileys' | 'wwebjs'>('baileys');
    const [currentProvider, setCurrentProvider] = useState<string | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/whatsapp');
            const data = await res.json();
            setStatus(data.status);
            setQrCode(data.qrCode || '');
            setPhoneNumber(data.phoneNumber || null);
            if (data.provider) {
                setCurrentProvider(data.provider);
            }
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

    // Listen to real-time WhatsApp status updates via Socket.io
    const { socket, isConnected } = useSocket();

    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleWhatsAppStatus = (data: {
            status: 'connecting' | 'ready' | 'qr' | 'disconnected';
            qr?: string;
            phoneNumber?: string;
        }) => {
            console.log('[WhatsApp Page] Received whatsapp:status event:', data);

            // Map 'qr' and 'connecting' to 'initializing'
            if (data.status === 'qr' || data.status === 'connecting') {
                setStatus('initializing');
            } else {
                setStatus(data.status as 'disconnected' | 'initializing' | 'ready');
            }

            setQrCode(data.qr || '');
            setPhoneNumber(data.phoneNumber || null);
        };

        socket.on('whatsapp:status', handleWhatsAppStatus);
        console.log('[WhatsApp Page] Listening to whatsapp:status events');

        return () => {
            socket.off('whatsapp:status', handleWhatsAppStatus);
            console.log('[WhatsApp Page] Stopped listening to whatsapp:status events');
        };
    }, [socket, isConnected]);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [queueState?.logs]);

    const handleConnect = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'connect',
                    provider: selectedProvider
                })
            });
            // Poll immediately after action
            setTimeout(checkStatus, 1000);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisconnect = async () => {
        setIsLoading(true);
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
            setIsLoading(false);
        }
    };

    // Test message modal state
    const [showTestModal, setShowTestModal] = useState(false);
    const [testPhone, setTestPhone] = useState('51981636027');
    const [testMessage, setTestMessage] = useState('Teste de conexão CRM');
    const [sendingTest, setSendingTest] = useState(false);

    const handleTestMessage = () => {
        setShowTestModal(true);
    };

    const handleSendTest = async () => {
        if (!testPhone) return;

        setSendingTest(true);
        try {
            const res = await fetch('/api/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send',
                    phone: testPhone,
                    message: testMessage
                })
            });

            const data = await res.json();

            if (res.ok) {
                toastSuccess('Mensagem de teste enviada!');
                setShowTestModal(false);
            } else {
                toastError(`Erro ao enviar teste: ${data.error || 'Erro desconhecido'}`);
            }
        } catch (error) {
            console.error(error);
            toastError('Erro de conexão com o servidor');
        } finally {
            setSendingTest(false);
        }
    };

    // YCloud test modal state
    const [showYCloudModal, setShowYCloudModal] = useState(false);
    const [yCloudPhone, setYCloudPhone] = useState('5551981636027');
    const [yCloudTemplate, setYCloudTemplate] = useState('');
    const [yCloudVariables, setYCloudVariables] = useState('');
    const [sendingYCloud, setSendingYCloud] = useState(false);
    const [yCloudConfigured, setYCloudConfigured] = useState(false);

    // Check if YCloud is configured
    useEffect(() => {
        const checkYCloud = async () => {
            try {
                const res = await fetch('/api/settings');
                const data = await res.json();
                setYCloudConfigured(!!(data.yCloudApiKey && data.yCloudPhoneId));
            } catch (e) {
                console.error('Error checking YCloud config:', e);
            }
        };
        checkYCloud();
    }, []);

    const handleYCloudTest = () => {
        setShowYCloudModal(true);
    };

    const handleSendYCloudTest = async () => {
        if (!yCloudPhone || !yCloudTemplate) {
            toastError('Preencha telefone e nome do template');
            return;
        }

        setSendingYCloud(true);
        try {
            // Parse variables (format: var1, var2, var3)
            const vars = yCloudVariables
                .split(',')
                .map((v, i) => ({ position: i + 1, value: v.trim() }))
                .filter(v => v.value);

            const res = await fetch('/api/ycloud/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: yCloudPhone,
                    templateName: yCloudTemplate,
                    variables: vars
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toastSuccess(`Mensagem YCloud enviada! ID: ${data.messageId}`);
                setShowYCloudModal(false);
            } else {
                toastError(`Erro YCloud: ${data.error || 'Erro desconhecido'}`);
            }
        } catch (error) {
            console.error(error);
            toastError('Erro de conexão com YCloud');
        } finally {
            setSendingYCloud(false);
        }
    };

    // Confirmation modal state
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'reset' | 'clearQueue' | null>(null);
    const [confirmMessage, setConfirmMessage] = useState('');

    const handleResetClick = () => {
        setConfirmAction('reset');
        setConfirmMessage('Isso irá desconectar e apagar completamente a sessão atual. Você precisará escanear o QR Code novamente.');
        setShowConfirmModal(true);
    };

    const handleClearQueueClick = () => {
        setConfirmAction('clearQueue');
        setConfirmMessage('Tem certeza que deseja limpar toda a fila de mensagens?');
        setShowConfirmModal(true);
    };

    const handleConfirm = async () => {
        setShowConfirmModal(false);

        if (confirmAction === 'reset') {
            setIsLoading(true);
            try {
                const res = await fetch('/api/whatsapp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'reset' })
                });
                if (res.ok) {
                    setStatus('disconnected');
                    setQrCode('');
                    toastSuccess('Sessão resetada com sucesso.');
                    await checkStatus();
                }
            } catch (error) {
                console.error(error);
                toastError('Erro ao resetar sessão.');
            } finally {
                setIsLoading(false);
            }
        } else if (confirmAction === 'clearQueue') {
            setIsLoading(true);
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
                setIsLoading(false);
            }
        }

        setConfirmAction(null);
    };

    // Calculate progress
    const total = queueState?.stats?.total || 0;
    const processed = queueState?.stats?.processed || 0;
    const failed = queueState?.stats?.failed || 0;
    const progress = total > 0 ? ((processed + failed) / total) * 100 : 0;

    // Format estimated time remaining
    const formatEstimatedTime = (seconds: number): string => {
        if (seconds <= 0) return '';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
        }
        return `${minutes}min`;
    };

    const estimatedTime = queueState?.estimatedTimeRemaining || 0;
    const estimatedTimeText = estimatedTime > 0 ? formatEstimatedTime(estimatedTime) : null;

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
                            status === 'connecting' || status === 'qr' ? 'Inicializando...' : 'Desconectado'}
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
                                {phoneNumber && (
                                    <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                        📱 +{phoneNumber}
                                    </p>
                                )}
                                {currentProvider && (
                                    <p style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--text-secondary)',
                                        backgroundColor: 'var(--bg-muted)',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        marginBottom: '0.5rem',
                                        display: 'inline-block'
                                    }}>
                                        {currentProvider === 'baileys' ? '🚀 Baileys' : '🌐 whatsapp-web.js'}
                                    </p>
                                )}
                                <p>O sistema está pronto para enviar mensagens.</p>

                                <div className={styles.actions}>
                                    <button
                                        onClick={handleDisconnect}
                                        className={styles.disconnectButton}
                                        disabled={isLoading}
                                    >
                                        {loading ? 'Processando...' : 'Desconectar'}
                                    </button>
                                    <button
                                        onClick={handleTestMessage}
                                        className={styles.testButton}
                                        disabled={isLoading}
                                    >
                                        <Send size={16} />
                                        Enviar Teste
                                    </button>
                                    {yCloudConfigured && (
                                        <button
                                            onClick={handleYCloudTest}
                                            className={styles.testButton}
                                            style={{ borderColor: '#0ea5e9', color: '#0ea5e9' }}
                                            disabled={isLoading}
                                            title="Testar envio via YCloud API"
                                        >
                                            <Cloud size={16} />
                                            YCloud
                                        </button>
                                    )}
                                    <button
                                        onClick={handleResetClick}
                                        className={styles.disconnectButton}
                                        style={{ backgroundColor: '#dc2626' }}
                                        disabled={isLoading}
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
                                            {/* If qrCode is a data URL (from Baileys), render as img */}
                                            {/* Otherwise use QRCode component (from whatsapp-web.js) */}
                                            {qrCode.startsWith('data:') ? (
                                                <img src={qrCode} alt="QR Code" style={{ width: 256, height: 256 }} />
                                            ) : (
                                                <QRCode value={qrCode} size={256} />
                                            )}
                                        </div>
                                        <p>Escaneie o QR Code com seu WhatsApp</p>
                                    </div>
                                ) : (
                                    <div className={styles.placeholderState}>
                                        <Smartphone size={48} className={styles.placeholderIcon} />
                                        <p>Selecione o provider e clique em conectar</p>
                                    </div>
                                )}

                                {/* Provider Selector - only show when disconnected */}
                                {status === 'disconnected' && (
                                    <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: '8px',
                                            fontSize: '0.875rem',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            Biblioteca de conexão:
                                        </label>
                                        <select
                                            value={selectedProvider}
                                            onChange={(e) => setSelectedProvider(e.target.value as 'baileys' | 'wwebjs')}
                                            className={styles.input}
                                            style={{
                                                width: 'auto',
                                                minWidth: '200px',
                                                textAlign: 'center',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="baileys">🚀 Baileys (Recomendado)</option>
                                            <option value="wwebjs">🌐 WhatsApp Web.js</option>
                                        </select>
                                        <p style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--text-muted)',
                                            marginTop: '8px'
                                        }}>
                                            {provider === 'baileys'
                                                ? 'Mais leve e rápido. Sem Puppeteer.'
                                                : 'Usa navegador Chromium. Mais pesado.'}
                                        </p>
                                    </div>
                                )}

                                <div className={styles.actions}>
                                    {status === 'connecting' || status === 'qr' ? (
                                        <button
                                            onClick={handleDisconnect}
                                            className={styles.disconnectButton}
                                            disabled={isLoading}
                                        >
                                            Cancelar
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleConnect}
                                            className={styles.connectButton}
                                            disabled={isLoading}
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
                                onClick={handleClearQueueClick}
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
                            {estimatedTimeText && (
                                <div className={styles.progressInfo} style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    <span>Tempo estimado restante</span>
                                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>⏱️ {estimatedTimeText}</span>
                                </div>
                            )}
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

            {/* Test Message Modal */}
            {showTestModal && (
                <div className={styles.modalOverlay} onClick={() => setShowTestModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Enviar Mensagem de Teste</h3>
                            <button onClick={() => setShowTestModal(false)} className={styles.closeButton}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.inputGroup}>
                                <label>Número de Telefone</label>
                                <input
                                    type="text"
                                    value={testPhone}
                                    onChange={e => setTestPhone(e.target.value)}
                                    placeholder="Ex: 51999999999"
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Mensagem</label>
                                <textarea
                                    value={testMessage}
                                    onChange={e => setTestMessage(e.target.value)}
                                    placeholder="Mensagem de teste..."
                                    className={styles.textarea}
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button
                                onClick={() => setShowTestModal(false)}
                                className={styles.secondaryButton}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSendTest}
                                className={styles.connectButton}
                                disabled={sendingTest || !testPhone}
                            >
                                {sendingTest ? 'Enviando...' : 'Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className={styles.modalOverlay} onClick={() => setShowConfirmModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Confirmar Ação</h3>
                            <button onClick={() => setShowConfirmModal(false)} className={styles.closeButton}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p style={{ color: 'var(--text-main)', lineHeight: 1.6 }}>{confirmMessage}</p>
                        </div>
                        <div className={styles.modalFooter}>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className={styles.secondaryButton}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={styles.disconnectButton}
                                style={{ backgroundColor: '#dc2626' }}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* YCloud Test Modal */}
            {showYCloudModal && (
                <div className={styles.modalOverlay} onClick={() => setShowYCloudModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Testar YCloud WhatsApp</h3>
                            <button onClick={() => setShowYCloudModal(false)} className={styles.closeButton}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.inputGroup}>
                                <label>Número de Telefone (com DDI)</label>
                                <input
                                    type="text"
                                    value={yCloudPhone}
                                    onChange={e => setYCloudPhone(e.target.value)}
                                    placeholder="Ex: 5551999999999"
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Nome do Template</label>
                                <input
                                    type="text"
                                    value={yCloudTemplate}
                                    onChange={e => setYCloudTemplate(e.target.value)}
                                    placeholder="Ex: hello_world"
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Variáveis (separadas por vírgula)</label>
                                <input
                                    type="text"
                                    value={yCloudVariables}
                                    onChange={e => setYCloudVariables(e.target.value)}
                                    placeholder="Ex: João, 25/12"
                                    className={styles.input}
                                />
                                <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                    Deixe vazio para templates sem variáveis
                                </small>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button
                                onClick={() => setShowYCloudModal(false)}
                                className={styles.secondaryButton}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSendYCloudTest}
                                className={styles.connectButton}
                                disabled={sendingYCloud || !yCloudPhone || !yCloudTemplate}
                            >
                                {sendingYCloud ? 'Enviando...' : 'Enviar via YCloud'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
