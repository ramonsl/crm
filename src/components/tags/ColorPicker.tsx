/**
 * ColorPicker Component
 * 
 * Simple color picker with predefined palette.
 * Single responsibility: Allow color selection.
 * 
 * @example
 * <ColorPicker value="#ef4444" onChange={(color) => setColor(color)} />
 */

'use client';

import { useState } from 'react';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
    value: string;
    onChange: (color: string) => void;
    className?: string;
}

const DEFAULT_COLORS = [
    '#ef4444', // red
    '#f59e0b', // amber
    '#10b981', // green
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#6b7280', // gray
    '#14b8a6', // teal
    '#f97316', // orange
    '#84cc16', // lime
    '#06b6d4', // cyan
    '#a855f7', // violet
];

export function ColorPicker({ value, onChange, className = '' }: ColorPickerProps) {
    const [customColor, setCustomColor] = useState(value);

    const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setCustomColor(newColor);
        onChange(newColor);
    };

    return (
        <div className={`${styles.colorPicker} ${className}`}>
            <div className={styles.palette}>
                {DEFAULT_COLORS.map((color) => (
                    <button
                        key={color}
                        type="button"
                        className={`${styles.colorButton} ${value === color ? styles.selected : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => onChange(color)}
                        title={color}
                        aria-label={`Selecionar cor ${color}`}
                    >
                        {value === color && (
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                className={styles.checkIcon}
                            >
                                <path
                                    d="M13.5 4.5L6 12L2.5 8.5"
                                    stroke="white"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        )}
                    </button>
                ))}
            </div>

            <div className={styles.customColorSection}>
                <label htmlFor="customColor" className={styles.label}>
                    Cor personalizada:
                </label>
                <div className={styles.customColorInput}>
                    <input
                        id="customColor"
                        type="color"
                        value={customColor}
                        onChange={handleCustomColorChange}
                        className={styles.colorInput}
                    />
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                setCustomColor(val);
                                if (val.length === 7) {
                                    onChange(val);
                                }
                            }
                        }}
                        placeholder="#000000"
                        maxLength={7}
                        className={styles.hexInput}
                    />
                </div>
            </div>
        </div>
    );
}
