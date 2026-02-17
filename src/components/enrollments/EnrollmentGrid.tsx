'use client';

import styles from './EnrollmentGrid.module.css';
import EnrollmentCard from './EnrollmentCard';
import { WeekdayGrid, WEEKDAYS_ORDER, WEEKDAY_LABELS } from '@/types/enrollment';

interface EnrollmentGridProps {
    grid: WeekdayGrid;
    onRoomUpdate: (enrollmentId: number, room: string) => Promise<void>;
}

export default function EnrollmentGrid({ grid, onRoomUpdate }: EnrollmentGridProps) {
    return (
        <div className={styles.gridContainer} id="enrollment-grid">
            {WEEKDAYS_ORDER.map((day) => {
                const items = grid[day] ?? [];
                const totalStudents = items.reduce((sum, item) => sum + item.enrolledStudents, 0);
                return (
                    <div key={day} className={styles.dayColumn}>
                        <div className={styles.dayHeader}>
                            <div className={styles.dayTitle}>{day}</div>
                            <div className={styles.daySubtitle}>{WEEKDAY_LABELS[day]}</div>
                            <div className={styles.dayCount}>
                                {items.length} {items.length === 1 ? 'disciplina' : 'disciplinas'} · {totalStudents} alunos
                            </div>
                        </div>
                        <div className={styles.cardList}>
                            {items.length === 0 ? (
                                <div className={styles.emptyDay}>Sem aulas</div>
                            ) : (
                                items.map((item) => (
                                    <EnrollmentCard
                                        key={`${item.classCode}-${item.subjectName}`}
                                        item={item}
                                        onRoomUpdate={onRoomUpdate}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
