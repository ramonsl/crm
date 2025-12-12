'use client';

/**
 * Auto-Reply List Component
 * Displays all auto-replies in a table format
 */

import type { AutoReply } from '@/types/autoReply';

interface AutoReplyListProps {
    replies: AutoReply[];
    onEdit: (reply: AutoReply) => void;
    onDelete: (id: number) => void;
    onToggle: (id: number) => void;
}

export function AutoReplyList({ replies, onEdit, onDelete, onToggle }: AutoReplyListProps) {
    if (replies.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500 text-lg">Nenhuma resposta automática cadastrada</p>
                <p className="text-gray-400 text-sm mt-2">
                    Clique em "Nova Resposta Automática" para começar
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nome / Intenção
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Resposta
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Confiança
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Prioridade
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ações
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {replies.map((reply) => (
                        <tr key={reply.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                    onClick={() => onToggle(reply.id)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${reply.is_active ? 'bg-blue-600' : 'bg-gray-300'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${reply.is_active ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900">{reply.name}</div>
                                <div className="text-sm text-gray-500 truncate max-w-xs">
                                    {reply.intent_description}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm text-gray-900 truncate max-w-md">
                                    {reply.response_template}
                                </div>
                                {reply.example_messages && reply.example_messages.length > 0 && (
                                    <div className="text-xs text-gray-400 mt-1">
                                        Exemplos: {reply.example_messages.slice(0, 2).join(', ')}
                                        {reply.example_messages.length > 2 && '...'}
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {(reply.confidence_threshold * 100).toFixed(0)}%
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {reply.priority}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                    onClick={() => onEdit(reply)}
                                    className="text-blue-600 hover:text-blue-900 mr-4"
                                >
                                    Editar
                                </button>
                                <button
                                    onClick={() => onDelete(reply.id)}
                                    className="text-red-600 hover:text-red-900"
                                >
                                    Deletar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
