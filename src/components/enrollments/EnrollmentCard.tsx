'use client';

import { useState, useCallback, useRef } from 'react';
import { AlertTriangle, Users, Hash, Clock, DoorOpen } from 'lucide-react';
import styles from './EnrollmentCard.module.css';
import { EnrollmentGridItem } from '@/types/enrollment';

interface EnrollmentCardProps {
    item: EnrollmentGridItem;
    onRoomUpdate: (enrollmentId: number, room: string) => Promise<void>;
}

export default function EnrollmentCard({ item, onRoomUpdate }: EnrollmentCardProps) {
    const [room, setRoom] = useState(item.room ?? '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleRoomChange = useCallback(
        (value: string) => {
            setRoom(value);
            setSaved(false);

            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            debounceRef.current = setTimeout(async () => {
                setSaving(true);
                try {
                    await onRoomUpdate(item.id, value);
                    setSaved(true);
                    setTimeout(() => setSaved(false), 2000);
                } catch (error) {
                    console.error('Erro ao salvar sala:', error);
                } finally {
                    setSaving(false);
                }
            }, 800);
        },
        [item.id, onRoomUpdate]
    );

    const availableClass = item.availableSlots > 0 ? styles.available : styles.availableZero;

    return (
        <div className={styles.card} id={`enrollment-card-${item.id}`}>
            <div className={styles.cardHeader}>
                <span className={styles.subjectName}>{item.subjectName}</span>
                <span className={styles.classCode}>{item.classCode}</span>
            </div>

            {item.schedule && (
                <div className={styles.schedule}>
                    <Clock size={11} />
                    <span>{item.schedule}</span>
                </div>
            )}

            <div className={styles.stats}>
                <span className={styles.stat}>
                    <Users size={12} className={styles.statIcon} />
                    <span className={styles.enrolled}>
                        {item.enrolledStudents}/{item.totalSlots}
                    </span>
                </span>
                <span className={styles.stat}>
                    <Hash size={12} className={styles.statIcon} />
                    <span className={availableClass}>
                        {item.availableSlots} {item.availableSlots === 1 ? 'vaga' : 'vagas'}
                    </span>
                </span>
            </div>

            {item.hasPracticeMismatch && (
                <div className={styles.alert} role="alert">
                    <AlertTriangle size={14} className={styles.alertIcon} />
                    <span className={styles.alertText}>
                        Prática com {item.practiceEnrolled} alunos
                        (teórica: {item.enrolledStudents})
                    </span>
                </div>
            )}

            <div className={styles.roomField}>
                <DoorOpen size={12} className={styles.roomLabel} />
                <input
                    type="text"
                    className={styles.roomInput}
                    value={room}
                    onChange={(e) => handleRoomChange(e.target.value)}
                    placeholder="Sala..."
                    aria-label={`Sala para ${item.subjectName}`}
                    id={`room-input-${item.id}`}
                />
                {saving && <span className={styles.roomLabel}>...</span>}
                {saved && <span className={styles.roomSaved}>✓</span>}
            </div>
        </div>
    );
}
