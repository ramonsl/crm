'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import styles from './MultiSelect.module.css';

interface MultiSelectProps {
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
}

export default function MultiSelect({ options, selected, onChange, placeholder = 'Selecione...' }: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter(item => item !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    return (
        <div className={styles.container} ref={containerRef}>
            <button
                className={styles.button}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span>
                    {selected.length === 0
                        ? placeholder
                        : selected.length === 1
                            ? selected[0]
                            : `${selected.length} selecionados`}
                </span>
                <ChevronDown size={16} />
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    {options.map(option => (
                        <div
                            key={option}
                            className={styles.option}
                            onClick={() => toggleOption(option)}
                        >
                            <input
                                type="checkbox"
                                checked={selected.includes(option)}
                                readOnly
                                className={styles.checkbox}
                            />
                            <span className={styles.label}>{option}</span>
                        </div>
                    ))}
                    {options.length === 0 && (
                        <div className={styles.option} style={{ cursor: 'default' }}>
                            <span className={styles.label} style={{ color: '#9ca3af' }}>Sem opções</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
