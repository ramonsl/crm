import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, duration = 3000, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setIsVisible(true));

        const timer = setTimeout(() => {
            setIsVisible(false);
            // Wait for exit animation to finish before removing
            setTimeout(() => onClose(id), 300);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle size={20} />;
            case 'error': return <AlertCircle size={20} />;
            case 'warning': return <AlertTriangle size={20} />;
            case 'info': return <Info size={20} />;
        }
    };

    const getColors = () => {
        switch (type) {
            case 'success': return 'border-l-4 border-green-500 text-green-500';
            case 'error': return 'border-l-4 border-red-500 text-red-500';
            case 'warning': return 'border-l-4 border-yellow-500 text-yellow-500';
            case 'info': return 'border-l-4 border-blue-500 text-blue-500';
        }
    };

    // Inline styles for simplicity and to match the dark theme without relying on Tailwind classes if not fully configured
    const baseStyle: React.CSSProperties = {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        marginBottom: '12px',
        borderRadius: '4px',
        backgroundColor: '#191c24', // var(--bg-surface)
        color: '#ffffff', // var(--text-main)
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.5)', // var(--shadow-md)
        minWidth: '300px',
        maxWidth: '400px',
        transition: 'all 0.3s ease-in-out',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        borderLeft: type === 'success' ? '4px solid #00d25b' :
            type === 'error' ? '4px solid #fc424a' :
                type === 'warning' ? '4px solid #ffab00' :
                    '4px solid #8f5fe8',
        pointerEvents: 'auto'
    };

    const iconColor = type === 'success' ? '#00d25b' :
        type === 'error' ? '#fc424a' :
            type === 'warning' ? '#ffab00' :
                '#8f5fe8';

    return (
        <div style={baseStyle}>
            <div style={{ marginRight: '12px', color: iconColor, display: 'flex' }}>
                {getIcon()}
            </div>
            <div style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>
                {message}
            </div>
            <button
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(() => onClose(id), 300);
                }}
                style={{
                    background: 'none',
                    border: 'none',
                    color: '#6c7293',
                    cursor: 'pointer',
                    marginLeft: '12px',
                    padding: '4px',
                    display: 'flex'
                }}
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast;
