/**
 * ColumnSelector - Dropdown component for selecting visible columns
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Columns } from 'lucide-react';
import type { VisibleColumns } from '@/hooks/useVisibleColumns';
import styles from './ColumnSelector.module.css';

interface ColumnSelectorProps {
    visibleColumns: VisibleColumns;
    onToggle: (column: keyof VisibleColumns) => void;
    onReset: () => void;
}

const COLUMNS = [
    { key: 'cpf' as keyof VisibleColumns, label: 'CPF' },
    { key: 'telefone' as keyof VisibleColumns, label: 'Telefone' },
    { key: 'status' as keyof VisibleColumns, label: 'Status' },
    { key: 'semestre' as keyof VisibleColumns, label: 'Semestre' },
    { key: 'ultima_mensagem' as keyof VisibleColumns, label: 'Última Mensagem' },
];

export function ColumnSelector({ visibleColumns, onToggle, onReset }: ColumnSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className={styles.container} ref={dropdownRef}>
            <button
                className={styles.trigger}
                onClick={() => setIsOpen(!isOpen)}
                title="Selecionar colunas"
            >
                <Columns size={18} />
                <span>Colunas</span>
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    <div className={styles.header}>
                        <span className={styles.title}>Colunas Visíveis</span>
                        <button className={styles.resetButton} onClick={onReset}>
                            Resetar
                        </button>
                    </div>

                    <div className={styles.options}>
                        <div className={styles.option}>
                            <input
                                type="checkbox"
                                id="col-nome"
                                checked={true}
                                disabled
                            />
                            <label htmlFor="col-nome" className={styles.locked}>
                                Nome (sempre visível)
                            </label>
                        </div>

                        {COLUMNS.map(column => (
                            <div key={column.key} className={styles.option}>
                                <input
                                    type="checkbox"
                                    id={`col-${column.key}`}
                                    checked={visibleColumns[column.key]}
                                    onChange={() => onToggle(column.key)}
                                />
                                <label htmlFor={`col-${column.key}`}>
                                    {column.label}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
