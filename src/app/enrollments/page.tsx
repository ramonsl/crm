'use client';

import { useState, useMemo } from 'react';
import { Upload, GraduationCap, Users, AlertTriangle, BookOpen } from 'lucide-react';
import styles from './page.module.css';
import EnrollmentGrid from '@/components/enrollments/EnrollmentGrid';
import EnrollmentImportModal from '@/components/enrollments/EnrollmentImportModal';
import { useEnrollments } from '@/hooks/useEnrollments';
import { WEEKDAYS_ORDER } from '@/types/enrollment';

export default function EnrollmentsPage() {
    const {
        semesters,
        selectedSemesterId,
        setSelectedSemesterId,
        grid,
        loading,
        error,
        refreshGrid,
        updateRoom,
    } = useEnrollments();

    const [showImportModal, setShowImportModal] = useState(false);

    // Calculate summary stats
    const summary = useMemo(() => {
        let totalSubjects = 0;
        let totalEnrolled = 0;
        let totalMismatches = 0;

        for (const day of WEEKDAYS_ORDER) {
            const items = grid[day] ?? [];
            totalSubjects += items.length;
            for (const item of items) {
                totalEnrolled += item.enrolledStudents;
                if (item.hasPracticeMismatch) totalMismatches++;
            }
        }

        return { totalSubjects, totalEnrolled, totalMismatches };
    }, [grid]);

    const hasData = summary.totalSubjects > 0;

    return (
        <div className={styles.pageContainer}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <GraduationCap size={28} style={{ color: 'var(--primary)' }} />
                    <h1 className={styles.title}>Enturmações</h1>
                </div>
                <div className={styles.headerRight}>
                    <select
                        className={styles.semesterSelect}
                        value={selectedSemesterId ?? ''}
                        onChange={(e) => setSelectedSemesterId(Number(e.target.value))}
                        id="semester-filter"
                    >
                        {semesters.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.code}
                            </option>
                        ))}
                    </select>
                    <button
                        className={styles.importButton}
                        onClick={() => setShowImportModal(true)}
                        id="open-import-modal"
                    >
                        <Upload size={16} />
                        Importar Planilha
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {hasData && (
                <div className={styles.summary}>
                    <div className={styles.summaryCard}>
                        <div className={`${styles.summaryIcon} ${styles.summaryIconBlue}`}>
                            <BookOpen size={18} />
                        </div>
                        <div>
                            <div className={styles.summaryLabel}>Disciplinas</div>
                            <div className={styles.summaryValue}>{summary.totalSubjects}</div>
                        </div>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={`${styles.summaryIcon} ${styles.summaryIconGreen}`}>
                            <Users size={18} />
                        </div>
                        <div>
                            <div className={styles.summaryLabel}>Alunos Enturmados</div>
                            <div className={styles.summaryValue}>{summary.totalEnrolled}</div>
                        </div>
                    </div>
                    {summary.totalMismatches > 0 && (
                        <div className={styles.summaryCard}>
                            <div className={`${styles.summaryIcon} ${styles.summaryIconOrange}`}>
                                <AlertTriangle size={18} />
                            </div>
                            <div>
                                <div className={styles.summaryLabel}>Divergências</div>
                                <div className={styles.summaryValue}>{summary.totalMismatches}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className={styles.loading}>Carregando enturmações...</div>
            ) : error ? (
                <div className={styles.error}>{error}</div>
            ) : hasData ? (
                <EnrollmentGrid grid={grid} onRoomUpdate={updateRoom} />
            ) : (
                <div className={styles.emptyState}>
                    <GraduationCap size={48} className={styles.emptyIcon} />
                    <div className={styles.emptyTitle}>Nenhuma enturmação encontrada</div>
                    <div className={styles.emptyText}>
                        Importe uma planilha de ocupação para visualizar as disciplinas
                        organizadas por dia da semana.
                    </div>
                    <button
                        className={styles.importButton}
                        onClick={() => setShowImportModal(true)}
                    >
                        <Upload size={16} />
                        Importar Planilha
                    </button>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <EnrollmentImportModal
                    semesters={semesters}
                    selectedSemesterId={selectedSemesterId}
                    onClose={() => setShowImportModal(false)}
                    onImportComplete={() => {
                        setShowImportModal(false);
                        refreshGrid();
                    }}
                />
            )}
        </div>
    );
}
