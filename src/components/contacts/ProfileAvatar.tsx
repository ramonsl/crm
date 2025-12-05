/**
 * ProfileAvatar - Display profile picture or badge with first letter
 * Supports status-colored borders and badges
 */

'use client';

import { STATUS_CONFIG } from '@/types/contacts';
import type { Contact } from '@/types/contacts';
import styles from './ProfileAvatar.module.css';

interface ProfileAvatarProps {
    contact: Contact;
    size?: 'small' | 'medium' | 'large';
}

export function ProfileAvatar({ contact, size = 'medium' }: ProfileAvatarProps) {
    const statusConfig = STATUS_CONFIG[contact.status] || { color: 'gray', label: contact.status };
    const firstLetter = contact.nome?.charAt(0).toUpperCase() || '?';

    if (contact.profile_image) {
        // Show profile picture with status-colored border
        return (
            <div
                className={`${styles.avatar} ${styles[size]} ${styles[`border-${statusConfig.color}`]}`}
                title={contact.nome}
            >
                <img
                    src={contact.profile_image}
                    alt={contact.nome}
                    className={styles.image}
                />
            </div>
        );
    }

    // Show badge with first letter and status color
    return (
        <div
            className={`${styles.avatar} ${styles[size]} ${styles.badge} ${styles[`bg-${statusConfig.color}`]}`}
            title={contact.nome}
        >
            <span className={styles.letter}>{firstLetter}</span>
        </div>
    );
}
