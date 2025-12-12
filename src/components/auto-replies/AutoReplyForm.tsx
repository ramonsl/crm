'use client';

/**
 * Auto-Reply Form Component
 * Modal form for creating/editing auto-replies
 * Following system modal patterns
 */

import { useState, useEffect } from 'react';
import type { AutoReply } from '@/types/autoReply';
import { X } from 'lucide-react';
import styles from './AutoReplies.module.css';

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
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>{reply ? 'Editar Resposta Automática' : 'Nova Resposta Automática'}</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Nome */}
                    <div className={styles.formGroup}>
                        <label>Nome da Intenção *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ex: Saudação, Pedido de Orçamento"
                            required
                        />
                    </div>

                    {/* Descrição da Intenção */}
                    <div className={styles.formGroup}>
                        <label>Descrição da Intenção (para a IA) *</label>
                        <textarea
                            value={formData.intent_description}
                            onChange={(e) => setFormData({ ...formData, intent_description: e.target.value })}
                            placeholder="Ex: Cliente está cumprimentando, dizendo olá, oi, bom dia"
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
                            required
                        />
                    </div>

                    {/* Exemplos de Mensagens */}
                    <div className={styles.formGroup}>
                        <label>Exemplos de Mensagens (opcional)</label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input
                                type="text"
                                value={newExample}
                                onChange={(e) => setNewExample(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExample())}
                                placeholder="Ex: Olá, Oi, Bom dia"
                                style={{ flex: 1 }}
                            />
                            <button
                                type="button"
                                onClick={addExample}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer'
                                }}
                            >
                                Adicionar
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {formData.example_messages.map((example, index) => (
                                <span
                                    key={index}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.25rem 0.75rem',
                                        background: 'rgba(0, 144, 231, 0.2)',
                                        border: '1px solid rgba(0, 144, 231, 0.3)',
                                        borderRadius: '9999px',
                                        color: 'var(--primary)',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    {example}
                                    <button
                                        type="button"
                                        onClick={() => removeExample(index)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--primary)',
                                            cursor: 'pointer',
                                            padding: 0,
                                            fontSize: '1.2rem',
                                            lineHeight: 1
                                        }}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Template de Resposta */}
                    <div className={styles.formGroup}>
                        <label>Template de Resposta *</label>
                        <textarea
                            value={formData.response_template}
                            onChange={(e) => setFormData({ ...formData, response_template: e.target.value })}
                            placeholder="Olá {{name}}! 👋 Como posso ajudar?"
                            rows={4}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-main)',
                                fontSize: '0.95rem',
                                fontFamily: 'monospace',
                                resize: 'vertical'
                            }}
                            required
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Variáveis disponíveis: {'{{name}}'}, {'{{phone}}'}, {'{{date}}'}, {'{{time}}'}
                        </p>
                    </div>

                    {/* Confidence Threshold */}
                    <div className={styles.formGroup}>
                        <label>Confiança Mínima: {(formData.confidence_threshold * 100).toFixed(0)}%</label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={formData.confidence_threshold}
                            onChange={(e) => setFormData({ ...formData, confidence_threshold: parseFloat(e.target.value) })}
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* Prioridade e Status */}
                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>Prioridade</label>
                            <input
                                type="number"
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <span>Ativo</span>
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className={styles.actions}>
                        <button
                            type="button"
                            onClick={onClose}
                            className={styles.cancelButton}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={styles.saveButton}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
