'use client';

/**
 * Auto-Reply Tester Component
 * Test intent detection in real-time
 * Following system UI patterns
 */

import { useState } from 'react';
import { Send } from 'lucide-react';
import styles from './AutoReplies.module.css';

interface TestResult {
    intent: string | null;
    confidence: number;
    threshold?: number;
    meetsThreshold?: boolean;
    response: string | null;
    message: string;
}

export function AutoReplyTester() {
    const [testMessage, setTestMessage] = useState('');
    const [result, setResult] = useState<TestResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleTest = async () => {
        if (!testMessage.trim()) return;

        setIsLoading(true);
        try {
            const res = await fetch('/api/auto-replies/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: testMessage }),
            });

            if (res.ok) {
                const data = await res.json();
                setResult(data);
            }
        } catch (error) {
            console.error('Error testing auto-reply:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.tableContainer}>
            <div style={{ padding: '2rem' }}>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '1.5rem', fontSize: '1.25rem' }}>
                    Testar Detecção de Intenção
                </h3>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Mensagem de Teste
                    </label>
                    <textarea
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        placeholder="Digite uma mensagem para testar..."
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'var(--bg-body)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-main)',
                            fontSize: '0.95rem',
                            fontFamily: 'inherit',
                            resize: 'vertical'
                        }}
                    />
                </div>

                <button
                    onClick={handleTest}
                    disabled={isLoading || !testMessage.trim()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        color: 'white',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: isLoading || !testMessage.trim() ? 'not-allowed' : 'pointer',
                        opacity: isLoading || !testMessage.trim() ? 0.5 : 1,
                        justifyContent: 'center'
                    }}
                >
                    <Send size={18} />
                    {isLoading ? 'Testando...' : 'Testar Intenção'}
                </button>

                {result && (
                    <div
                        style={{
                            marginTop: '2rem',
                            padding: '1.5rem',
                            background: result.meetsThreshold ? 'rgba(0, 210, 91, 0.1)' : 'rgba(255, 171, 0, 0.1)',
                            border: `1px solid ${result.meetsThreshold ? 'rgba(0, 210, 91, 0.3)' : 'rgba(255, 171, 0, 0.3)'}`,
                            borderRadius: 'var(--radius-md)'
                        }}
                    >
                        <h4 style={{ color: 'var(--text-main)', marginBottom: '1rem', fontSize: '1.1rem' }}>
                            Resultado:
                        </h4>

                        {result.intent ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Intenção Detectada:</span>
                                    <div style={{ marginTop: '0.25rem', color: 'var(--primary)', fontWeight: 600, fontSize: '1.1rem' }}>
                                        {result.intent}
                                    </div>
                                </div>

                                <div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Confiança:</span>
                                    <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span
                                            style={{
                                                color: result.meetsThreshold ? 'var(--success)' : 'var(--warning)',
                                                fontWeight: 600,
                                                fontSize: '1.1rem'
                                            }}
                                        >
                                            {((result.confidence || 0) * 100).toFixed(1)}%
                                        </span>
                                        {result.threshold && (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                (mínimo: {(result.threshold * 100).toFixed(0)}%)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {result.response && (
                                    <div>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>
                                            Resposta que seria enviada:
                                        </span>
                                        <div
                                            style={{
                                                padding: '1rem',
                                                background: 'var(--bg-body)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-main)'
                                            }}
                                        >
                                            {result.response}
                                        </div>
                                    </div>
                                )}

                                {!result.meetsThreshold && (
                                    <div style={{ color: 'var(--warning)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                        ⚠️ {result.message}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ color: 'var(--text-muted)' }}>
                                ❌ {result.message}
                            </div>
                        )}
                    </div>
                )}

                <div
                    style={{
                        marginTop: '2rem',
                        padding: '1rem',
                        background: 'rgba(0, 144, 231, 0.1)',
                        border: '1px solid rgba(0, 144, 231, 0.3)',
                        borderRadius: 'var(--radius-md)'
                    }}
                >
                    <div style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: '0.5rem' }}>💡 Dica</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                        Use esta ferramenta para testar se suas intenções estão bem configuradas.
                        A IA analisa a mensagem e determina qual intenção melhor se encaixa.
                    </p>
                </div>
            </div>
        </div>
    );
}
