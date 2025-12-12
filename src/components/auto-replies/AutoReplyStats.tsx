'use client';

/**
 * Auto-Reply Stats Component
 * Display usage statistics and analytics
 */

import { useState, useEffect } from 'react';
import type { AutoReplyStats as StatsType } from '@/types/autoReply';

export function AutoReplyStats() {
    const [stats, setStats] = useState<StatsType | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/auto-replies/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
                <p className="mt-2 text-gray-600">Carregando estatísticas...</p>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="text-center py-12 text-gray-500">
                Erro ao carregar estatísticas
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="text-sm font-medium text-gray-500 mb-1">Hoje</div>
                    <div className="text-3xl font-bold text-gray-900">{stats.total_sent_today}</div>
                    <div className="text-sm text-gray-600 mt-1">respostas enviadas</div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="text-sm font-medium text-gray-500 mb-1">Esta Semana</div>
                    <div className="text-3xl font-bold text-gray-900">{stats.total_sent_week}</div>
                    <div className="text-sm text-gray-600 mt-1">respostas enviadas</div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="text-sm font-medium text-gray-500 mb-1">Este Mês</div>
                    <div className="text-3xl font-bold text-gray-900">{stats.total_sent_month}</div>
                    <div className="text-sm text-gray-600 mt-1">respostas enviadas</div>
                </div>
            </div>

            {/* Average Confidence */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Confiança Média
                </h3>
                <div className="flex items-center">
                    <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-600 rounded-full"
                                style={{ width: `${stats.avg_confidence * 100}%` }}
                            />
                        </div>
                    </div>
                    <div className="ml-4 text-2xl font-bold text-gray-900">
                        {(stats.avg_confidence * 100).toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* By Intent */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Respostas por Intenção
                </h3>

                {stats.by_intent.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                        Nenhuma resposta enviada ainda
                    </p>
                ) : (
                    <div className="space-y-3">
                        {stats.by_intent.map((item, index) => (
                            <div key={index} className="flex items-center">
                                <div className="flex-1">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium text-gray-700">
                                            {item.name}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {item.count} {item.count === 1 ? 'vez' : 'vezes'}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-600 rounded-full"
                                            style={{
                                                width: `${stats.by_intent.length > 0
                                                        ? (item.count / Math.max(...stats.by_intent.map(i => i.count))) * 100
                                                        : 0
                                                    }%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
