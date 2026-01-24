'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { QrCode, RefreshCw, Smartphone, CheckCircle, AlertCircle, Terminal, Send, X, Cloud } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useToast } from '@/contexts/ToastContext';
import { useSocket } from '@/contexts/SocketContext';

export default function WhatsAppPage() {
    const { success: toastSuccess, error: toastError } = useToast();
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'qr' | 'ready'>('disconnected');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [queueState, setQueueState] = useState<any>(null);
    const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
    const [whatsappError, setWhatsappError] = useState<string | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<'baileys' | 'wwebjs' | 'wppconnect' | 'ycloud'>('baileys');


    const [currentProvider, setCurrentProvider] = useState<string | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // YCloud State
    const [yCloudConfigured, setYCloudConfigured] = useState(false);
    const [showYCloudModal, setShowYCloudModal] = useState(false);
    const [yCloudPhone, setYCloudPhone] = useState('');
    const [yCloudTemplate, setYCloudTemplate] = useState('hello_world');
    const [yCloudVariables, setYCloudVariables] = useState('');
    const [sendingYCloud, setSendingYCloud] = useState(false);

    interface YCloudTemplate {
        id: string;
        name: string;
        language: string;
        status: string;
    }
    const [ycloudTemplates, setYCloudTemplates] = useState<YCloudTemplate[]>([]);

    // Test Modal State (Web)
    const [showTestModal, setShowTestModal] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [testMessage, setTestMessage] = useState('');
    const [sendingTest, setSendingTest] = useState(false);

    // Confirmation Modal
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    // MUST be declared BEFORE any useEffect that uses isConnected
    const { socket, isConnected } = useSocket();

    const checkStatus = async () => {
        try {
            // Fix: Do not send desiredProvider to avoid forcing a reset/reinitialization
            // Just query the current status
            const res = await fetch('/api/whatsapp');
            const data = await res.json();
            console.log('[WhatsAppPage] Status Check Response:', data); // DEBUG
            setStatus(data.status);
            setQrCode(data.qrCode || '');
            setPhoneNumber(data.phoneNumber || null);
            setWhatsappError(data.error || null);
            if (data.official && data.web) {
                // Dual status logic
                const isOfficialReady = data.official.ready;
                const isWebReady = data.web.status === 'ready' || data.web.status === 'connected'; // Normalize 'connected'

                // Composite status
                if (isOfficialReady && isWebReady) setStatus('ready');
                else if (isOfficialReady || isWebReady) setStatus('ready'); // Partially ready is still ready for UI
                else setStatus(data.web.status || 'disconnected');

                setQrCode(data.web.qr || '');
                setPhoneNumber(data.web.phoneNumber || null);
                setWhatsappError(data.error || null);

                // Store provider types for UI display
                setCurrentProvider(data.web.provider || 'baileys'); // Web backup

                // Update YCloud status
                console.log('[WhatsAppPage] YCloud Configured (Official):', data.official.configured); // DEBUG
                setYCloudConfigured(data.official.configured || false);
            } else {
                // Fallback for unexpected response structure
                setStatus(data.status);
                setQrCode(data.qrCode || '');
                setPhoneNumber(data.phoneNumber || null);
                setWhatsappError(data.error || null);
                if (data.provider) {
                    setCurrentProvider(data.provider);
                    setSelectedProvider(data.provider);
                }

                // Try to infer YCloud status if available adjacent
                if (data.official) {
                    console.log('[WhatsAppPage] YCloud Configured (Fallback):', data.official.configured); // DEBUG
                    setYCloudConfigured(data.official.configured || false);
                }
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
        // Initial check
        checkStatus();
        fetchQueueState();

        // Only poll if Socket.io is NOT connected
        // When Socket.io is connected, we get real-time updates
        if (!isConnected) {
            console.log('[WhatsApp Page] Socket.io not connected, starting polling...');
            const interval = setInterval(() => {
                checkStatus();
                fetchQueueState();
            }, 2000);
            return () => clearInterval(interval);
        } else {
            console.log('[WhatsApp Page] Socket.io connected, polling disabled (using real-time events)');
        }
    }, [isConnected]);

    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleWhatsAppStatus = (data: {
            status: 'connecting' | 'ready' | 'qr' | 'disconnected';
            qr?: string;
            phoneNumber?: string;
            error?: string;
        }) => {
            // Update status directly (don't map qr to initializing!)
            setStatus(data.status);

            // CRITICAL: Update QR Code state
            if (data.qr) {
                setQrCode(data.qr);
            } else if (data.status !== 'qr') {
                // Only clear QR if status is NOT qr
                setQrCode('');
            }

            setPhoneNumber(data.phoneNumber || null);
            setWhatsappError(data.error || null);
        };

        const handleQueueUpdate = (data: any) => {
            setQueueState(data);
        };

        socket.on('whatsapp:status', handleWhatsAppStatus);
        socket.on('queue:update', handleQueueUpdate);

        return () => {
            socket.off('whatsapp:status', handleWhatsAppStatus);
            socket.off('queue:update', handleQueueUpdate);
        };
    }, [socket, isConnected]);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [queueState?.logs]);

    const [yCloudBalance, setYCloudBalance] = useState<string | null>(null);

    const fetchYCloudBalance = async () => {
        try {
            const res = await fetch('/api/ycloud/balance');
            if (res.ok) {
                const data = await res.json();
                // Assumindo que a API retorna balance e currency. Se retornar array ou outro formato, ajustaremos.
                // Ex: { balance: 10.50, currency: "USD" } -> "$ 10.50"
                if (data.amount !== undefined && data.currency) {
                    setYCloudBalance(`${data.currency} ${data.amount}`);
                } else if (data.balance !== undefined) {
                    setYCloudBalance(data.currency ? `${data.currency} ${data.balance}` : `${data.balance}`);
                } else {
                    setYCloudBalance(null); // formato desconhecido
                    console.log('Balance format unknown:', data);
                }
            }
        } catch (error) {
            console.error('Failed to fetch balance:', error);
        }
    };

    const fetchYCloudTemplates = async () => {
        try {
            const res = await fetch('/api/ycloud/templates');
            if (res.ok) {
                const data = await res.json();
                // Filter only APPROVED templates
                const approved = data.filter((t: YCloudTemplate) => t.status === 'APPROVED');
                setYCloudTemplates(approved);

                // Pre-select first template if none selected or current is invalid
                if (approved.length > 0 && (!yCloudTemplate || !approved.find((t: YCloudTemplate) => t.name === yCloudTemplate))) {
                    setYCloudTemplate(approved[0].name);
                }
            }
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        }
    };

    useEffect(() => {
        if (yCloudConfigured) {
            fetchYCloudBalance();
        }
    }, [yCloudConfigured]);

    const handleYCloudTest = () => {
        fetchYCloudTemplates();
        setShowYCloudModal(true);
    };

    const handleSendYCloudTest = async () => {
        if (!yCloudPhone || !yCloudTemplate) return;

        setSendingYCloud(true);
        try {
            // Parse variables
            const variables = yCloudVariables.split(',').map((v, i) => ({
                position: i + 1,
                value: v.trim()
            })).filter(v => v.value !== '');

            // Send via provider agnostic queue but specifying provider ycloud
            const res = await fetch('/api/whatsapp/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{
                        phone: yCloudPhone,
                        templateName: yCloudTemplate,
                        variables: variables,
                        provider: 'ycloud'
                    }]
                })
            });

            if (res.ok) {
                toastSuccess('Mensagem de teste YCloud enviada para fila!');
                setShowYCloudModal(false);
                setYCloudVariables('');
            } else {
                const data = await res.json();
                toastError(data.error || 'Erro ao enviar mensagem');
            }
        } catch (error) {
            console.error(error);
            toastError('Erro de conexão');
        } finally {
            setSendingYCloud(false);
        }
    };

    const handleTestMessage = () => {
        setShowTestModal(true);
    };

    const handleSendTest = async () => {
        if (!testPhone || !testMessage) return;

        setSendingTest(true);
        try {
            // Send via provider agnostic queue
            const res = await fetch('/api/whatsapp/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{
                        phone: testPhone,
                        message: testMessage,
                        provider: currentProvider // Default to current web provider
                    }]
                })
            });

            if (res.ok) {
                toastSuccess('Mensagem de teste enviada para fila!');
                setShowTestModal(false);
                setTestMessage('');
            } else {
                const data = await res.json();
                toastError(data.error || 'Erro ao enviar mensagem');
            }
        } catch (error) {
            console.error(error);
            toastError('Erro de conexão');
        } finally {
            setSendingTest(false);
        }
    };

    const handleConnect = async () => {
        try {
            setIsLoading(true);
            await fetch('/api/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'connect', provider: selectedProvider })
            });
            // Status update will come via socket or polling
        } catch (error) {
            console.error(error);
            toastError('Erro ao iniciar conexão');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisconnect = () => {
        setConfirmMessage('Tem certeza que deseja desconectar o WhatsApp Web? Você precisará ler o QR Code novamente.');
        setPendingAction(() => async () => {
            try {
                await fetch('/api/whatsapp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'disconnect' })
                });
                toastSuccess('Desconectado com sucesso');
            } catch (error) {
                console.error(error);
                toastError('Erro ao desconectar');
            }
        });
        setShowConfirmModal(true);
    };

    const handleResetClick = () => {
        setConfirmMessage('Isso irá reiniciar o serviço do WhatsApp Web forçadamente. Deseja continuar?');
        setPendingAction(() => async () => {
            try {
                await fetch('/api/whatsapp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'disconnect' }) // Reset usually just disconnects/restarts
                });
                toastSuccess('Reiniciando serviço...');
            } catch (error) {
                console.error(error);
                toastError('Erro ao reiniciar');
            }
        });
        setShowConfirmModal(true);
    };

    const handleClearQueueClick = async () => {
        try {
            const res = await fetch('/api/whatsapp/queue', { method: 'DELETE' });
            if (res.ok) {
                toastSuccess('Fila limpa com sucesso');
                fetchQueueState();
            }
        } catch (e) {
            toastError('Erro ao limpar fila');
        }
    };

    const handleConfirm = () => {
        if (pendingAction) {
            pendingAction();
            setPendingAction(null);
        }
        setShowConfirmModal(false);
    };

    // Calculate progress (visual)
    const processed = queueState?.stats?.processed || 0;
    const failed = queueState?.stats?.failed || 0;
    const total = queueState?.stats?.total || 1; // avoid div/0
    const progress = total > 0 ? ((processed + failed) / total) * 100 : 0;
    const estimatedTime = queueState?.estimatedTimeRemaining || 0;
    const estimatedTimeText = estimatedTime > 0
        ? estimatedTime > 60 ? `${Math.ceil(estimatedTime / 60)} min` : `${estimatedTime} seg`
        : null;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>WhatsApp Connection</h1>
                    <p className={styles.subtitle}>Gerencie suas conexões (Oficial e Web)</p>
                </div>
                <div className={styles.statusBadge}>
                    <div className={`${styles.statusDot} ${status === 'ready' ? styles.ready : styles[status]}`} />
                    <span>
                        {status === 'ready' ? 'Online' : 'Desconectado'}
                    </span>
                </div>
            </header>

            <div className={styles.grid}>
                {/* Main Connection Card */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3>Conexões WhatsApp</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {yCloudConfigured && <span className={styles.tagOfficial}>Oficial Ativo</span>}
                            <span className={styles.tag}>{selectedProvider}</span>
                        </div>
                    </div>
                    <div className={styles.cardBody}>
                        {/* Web Connection Status */}
                        <div className={styles.webSection}>
                            {status === 'ready' && currentProvider !== 'ycloud' ? (
                                <div className={styles.connectedState}>
                                    <div className={styles.iconCircle}>
                                        <CheckCircle size={48} color="#10b981" />
                                    </div>
                                    <h3>WhatsApp Web Conectado</h3>
                                    {phoneNumber && <p className={styles.phone}>{phoneNumber}</p>}
                                    <div className={styles.actions}>
                                        <button onClick={handleDisconnect} className={styles.disconnectButton}>Desconectar</button>
                                        <button onClick={handleTestMessage} className={styles.testButton}>Testar</button>
                                        <button onClick={handleResetClick} className={styles.disconnectButton} style={{ backgroundColor: '#dc2626' }}><RefreshCw size={16} /></button>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.disconnectedState}>
                                    {qrCode ? (
                                        <div className={styles.qrContainer}>
                                            <div style={{ background: 'white', padding: '16px' }}>
                                                {qrCode.startsWith('data:') ? (
                                                    <img src={qrCode} alt="QR Code" style={{ width: 200, height: 200 }} />
                                                ) : (
                                                    <QRCode value={qrCode} size={200} />
                                                )}
                                            </div>
                                            <p>Escaneie o QR Code</p>
                                        </div>
                                    ) : (
                                        <div className={styles.placeholderState}>
                                            <Smartphone size={32} className={styles.placeholderIcon} />
                                            <p>WhatsApp Web Desconectado</p>
                                            <div style={{ marginTop: '1rem' }}>
                                                <select
                                                    value={selectedProvider}
                                                    onChange={e => setSelectedProvider(e.target.value as any)}
                                                    className={styles.input}
                                                    style={{ marginBottom: '0.5rem' }}
                                                >
                                                    <option value="baileys">Baileys</option>
                                                    <option value="wwebjs">WWebJS</option>
                                                </select>
                                                <button onClick={handleConnect} className={styles.connectButton} disabled={isLoading}>
                                                    {isLoading ? 'Conectando...' : 'Gerar QR Code'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* YCloud Section (Compact) */}
                        {yCloudConfigured && (
                            <div className={styles.ycloudCompact}>
                                <div className={styles.ycloudHeader}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Cloud size={20} color="#0ea5e9" />
                                        <span style={{ fontWeight: 600, color: '#0ea5e9' }}>API Oficial</span>
                                    </div>
                                    <span className={styles.statusDot} style={{ background: '#0ea5e9' }}></span>
                                </div>
                                <div className={styles.ycloudActions}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Conectado</span>
                                        {yCloudBalance !== null && (
                                            <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                                                Saldo: {yCloudBalance}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleYCloudTest}
                                        className={styles.miniButton}
                                    >
                                        Testar Envio
                                    </button>
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
                                disabled={isLoading || queueState?.queueLength === 0}
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
                                <select
                                    value={yCloudTemplate}
                                    onChange={e => setYCloudTemplate(e.target.value)}
                                    className={styles.input}
                                >
                                    <option value="" disabled>Selecione um template</option>
                                    {ycloudTemplates.length > 0 ? (
                                        ycloudTemplates.map((t) => (
                                            <option key={t.id} value={t.name}>
                                                {t.name} ({t.language})
                                            </option>
                                        ))
                                    ) : (
                                        <option value="hello_world">hello_world (Fallback)</option>
                                    )}
                                </select>
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
