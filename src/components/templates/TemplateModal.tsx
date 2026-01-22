'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './Templates.module.css';

interface Template {
    id: number;
    name: string;
    message: string;
    type?: string;
}

interface TemplateModalProps {
    template?: Template | null;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function TemplateModal({ template, open, onClose, onSuccess }: TemplateModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        message: '',
        type: 'fixed',
    });

    useEffect(() => {
        if (template) {
            setFormData({
                name: template.name,
                message: template.message,
                type: template.type || 'fixed',
            });
        } else {
            setFormData({
                name: '',
                message: '',
                type: 'fixed',
            });
        }
    }, [template, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const method = template ? 'PUT' : 'POST';
            const body = template ? { ...formData, id: template.id } : formData;

            const res = await fetch('/api/templates', {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao salvar modelo');
            }

            onSuccess();
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Erro desconhecido');
            }
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>{template ? 'Editar Modelo' : 'Novo Modelo'}</h3>
                    <button onClick={onClose} className={styles.iconButton}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.modalBody}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="type">Tipo de Modelo</label>
                        <select
                            id="type"
                            className={styles.select}
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="fixed">Mensagem Fixa</option>
                            <option value="ai">Mensagem com IA</option>
                        </select>
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="name">Nome do Modelo</label>
                        <input
                            id="name"
                            className={styles.input}
                            placeholder="Ex: Boas-vindas"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="message">
                            {formData.type === 'ai' ? 'Prompt para a IA' : 'Mensagem'}
                        </label>
                        <textarea
                            id="message"
                            className={styles.textarea}
                            placeholder={formData.type === 'ai' ?
                                "Ex: Crie uma mensagem de boas-vindas amigável para {nome}..." :
                                "Ex: Olá {nome}, tudo bem?"}
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            required
                        />
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Dica: Use <strong>{'{nome}'}</strong> (primeiro nome), <strong>{'{nome_completo}'}</strong>, <strong>{'{curso}'}</strong> ou <strong>{'{escola}'}</strong> para personalizar.
                        </p>
                    </div>

                    {error && <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>}

                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className={styles.primaryButton} disabled={loading || !formData.name.trim() || !formData.message.trim()}>
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
