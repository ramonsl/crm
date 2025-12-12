'use client';

/**
 * Auto-Reply Tester Component
 * Test intent detection in real-time
 */

import { useState } from 'react';

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
        <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Testar Detecção de Intenção
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Mensagem de Teste
                        </label>
                        <textarea
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={3}
                            placeholder="Digite uma mensagem para testar..."
                        />
                    </div>

                    <button
                        onClick={handleTest}
                        disabled={isLoading || !testMessage.trim()}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {isLoading ? 'Testando...' : 'Testar Intenção'}
                    </button>

                    {result && (
                        <div className={`mt-6 p-4 rounded-lg border ${result.meetsThreshold
                                ? 'bg-green-50 border-green-200'
                                : 'bg-yellow-50 border-yellow-200'
                            }`}>
                            <h4 className="font-semibold text-gray-900 mb-3">Resultado:</h4>

                            <div className="space-y-2 text-sm">
                                {result.intent ? (
                                    <>
                                        <div>
                                            <span className="font-medium">Intenção Detectada:</span>{' '}
                                            <span className="text-blue-600 font-semibold">{result.intent}</span>
                                        </div>

                                        <div>
                                            <span className="font-medium">Confiança:</span>{' '}
                                            <span className={`font-semibold ${(result.confidence || 0) >= (result.threshold || 0.7)
                                                    ? 'text-green-600'
                                                    : 'text-yellow-600'
                                                }`}>
                                                {((result.confidence || 0) * 100).toFixed(1)}%
                                            </span>
                                            {result.threshold && (
                                                <span className="text-gray-500">
                                                    {' '}(mínimo: {(result.threshold * 100).toFixed(0)}%)
                                                </span>
                                            )}
                                        </div>

                                        {result.response && (
                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                <span className="font-medium block mb-2">Resposta que seria enviada:</span>
                                                <div className="bg-white p-3 rounded border border-gray-200">
                                                    {result.response}
                                                </div>
                                            </div>
                                        )}

                                        {!result.meetsThreshold && (
                                            <div className="mt-3 text-yellow-700">
                                                ⚠️ {result.message}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-gray-600">
                                        ❌ {result.message}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">💡 Dica</h4>
                <p className="text-sm text-blue-800">
                    Use esta ferramenta para testar se suas intenções estão bem configuradas.
                    A IA analisa a mensagem e determina qual intenção melhor se encaixa.
                </p>
            </div>
        </div>
    );
}
