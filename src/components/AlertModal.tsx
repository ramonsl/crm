/**
 * AlertModal - Simple modal for displaying alerts and messages
 */

'use client';

import { X, AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';
import styles from './AlertModal.module.css';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
}

export function AlertModal({ isOpen, onClose, title, message, type = 'info' }: AlertModalProps) {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle size={20} color="#16a34a" />;
            case 'error':
                return <XCircle size={20} color="#dc2626" />;
            case 'warning':
                return <AlertCircle size={20} color="#f59e0b" />;
            default:
                return <Info size={20} color="#3b82f6" />;
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleContainer}>
                        {getIcon()}
                        <h3>{title}</h3>
                    </div>
                    <button onClick={onClose} className={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    <p>{message}</p>
                </div>

                <div className={styles.actions}>
                    <button onClick={onClose} className={styles.okButton}>
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
