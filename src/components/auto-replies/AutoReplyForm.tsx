'use client';

/**
 * Auto-Reply Form Component
 * Modal form for creating/editing auto-replies
 */

import { useState, useEffect } from 'react';
import type { AutoReply } from '@/types/autoReply';

interface AutoReplyFormProps {
    reply: AutoReply | null;
    onClose: () => void;
}

export function AutoReplyForm({ reply, onClose }: AutoReplyFormProps) {
    const [formData, setFormData] = useState({
        name: '',
        intent_description: '',
        example_messages: [] as string[],
        response_template: '',
        is_active: true,
        priority: 0,
        confidence_threshold: 0.70,
    });
    const [newExample, setNewExample] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (reply) {
            setFormData({
                name: reply.name,
                intent_description: reply.intent_description,
                example_messages: reply.example_messages || [],
                response_template: reply.response_template,
                is_active: reply.is_active,
                priority: reply.priority,
                confidence_threshold: reply.confidence_threshold,
            });
        }
    }, [reply]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const url = reply ? `/api/auto-replies/${reply.id}` : '/api/auto-replies';
            const method = reply ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                onClose();
            } else {
                alert('Erro ao salvar resposta automática');
            }
        } catch (error) {
            console.error('Error saving auto-reply:', error);
            alert('Erro ao salvar resposta automática');
        } finally {
            setIsSubmitting(false);
        }
    };

    const addExample = () => {
        if (newExample.trim()) {
            setFormData({
                ...formData,
                example_messages: [...formData.example_messages, newExample.trim()],
            });
            setNewExample('');
        }
    };

    const removeExample = (index: number) => {
        setFormData({
            ...formData,
            example_messages: formData.example_messages.filter((_, i) => i !== index),
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        {reply ? 'Editar Resposta Automática' : 'Nova Resposta Automática'}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Nome */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nome da Intenção *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ex: Saudação, Pedido de Orçamento"
                                required
                            />
                        </div>

                        {/* Descrição da Intenção */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Descrição da Intenção (para a IA) *
                            </label>
                            <textarea
                                value={formData.intent_description}
                                onChange={(e) => setFormData({ ...formData, intent_description: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows={3}
                                placeholder="Ex: Cliente está cumprimentando, dizendo olá, oi, bom dia, boa tarde"
                                required
                            />
                        </div>

                        {/* Exemplos de Mensagens */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Exemplos de Mensagens (opcional)
                            </label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={newExample}
                                    onChange={(e) => setNewExample(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExample())}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Ex: Olá, Oi, Bom dia"
                                />
                                <button
                                    type="button"
                                    onClick={addExample}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Adicionar
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {formData.example_messages.map((example, index) => (
                                    <span
                                        key={index}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                                    >
                                        {example}
                                        <button
                                            type="button"
                                            onClick={() => removeExample(index)}
                                            className="text-blue-600 hover:text-blue-800"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Template de Resposta */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Template de Resposta *
                            </label>
                            <textarea
                                value={formData.response_template}
                                onChange={(e) => setFormData({ ...formData, response_template: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                rows={4}
                                placeholder="Olá {{name}}! 👋 Como posso ajudar?"
                                required
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Variáveis disponíveis: {'{'}{'{'} name{'}'}{'}'}, {'{'}{'{'} phone{'}'}{'}'},  {'{'}{'{'} date{'}'}{'}'}, {'{'}{'{'} time{'}'}{'}'}
                            </p>
                        </div>

                        {/* Confidence Threshold */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Confiança Mínima: {(formData.confidence_threshold * 100).toFixed(0)}%
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={formData.confidence_threshold}
                                onChange={(e) => setFormData({ ...formData, confidence_threshold: parseFloat(e.target.value) })}
                                className="w-full"
                            />
                        </div>

                        {/* Prioridade e Status */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Prioridade
                                </label>
                                <input
                                    type="number"
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Status
                                </label>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">Ativo</span>
                                </label>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                disabled={isSubmitting}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
