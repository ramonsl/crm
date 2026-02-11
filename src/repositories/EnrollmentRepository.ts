/**
 * Enrollment Repository — Data access layer for enrollments
 *
 * Follows DIP: Uses interface for dependency inversion.
 * All queries use Prepared Statements ($1, $2, ...) for SQL Injection prevention.
 */

import { pool } from '@/lib/db';
import { Enrollment, Semester } from '@/types/enrollment';

// ============================================================================
// Interface
// ============================================================================

export interface IEnrollmentRepository {
    findSemesters(): Promise<Semester[]>;
    createSemester(code: string): Promise<Semester>;
    deleteEnrollmentsBySemester(semesterId: number): Promise<number>;
    bulkInsertEnrollments(
        enrollments: Omit<Enrollment, 'id' | 'imported_at'>[]
    ): Promise<number>;
    findBySemester(semesterId: number): Promise<Enrollment[]>;
    updateRoom(enrollmentId: number, room: string): Promise<void>;
}

// ============================================================================
// Implementation
// ============================================================================

export class EnrollmentRepository implements IEnrollmentRepository {
    /**
     * Lists all semesters ordered by code descending (most recent first)
     */
    async findSemesters(): Promise<Semester[]> {
        const result = await pool.query(
            'SELECT id, code, active, created_at FROM semesters ORDER BY code DESC'
        );
        return result.rows as Semester[];
    }

    /**
     * Creates a new semester
     */
    async createSemester(code: string): Promise<Semester> {
        const result = await pool.query(
            'INSERT INTO semesters (code) VALUES ($1) RETURNING id, code, active, created_at',
            [code]
        );
        return result.rows[0] as Semester;
    }

    /**
     * Deletes all enrollments for a given semester (used before re-import)
     */
    async deleteEnrollmentsBySemester(semesterId: number): Promise<number> {
        const result = await pool.query(
            'DELETE FROM enrollments WHERE semester_id = $1',
            [semesterId]
        );
        return result.rowCount ?? 0;
    }

    /**
     * Bulk inserts enrollment records using a single multi-row INSERT.
     * Avoids N+1 queries by building a single statement.
     */
    async bulkInsertEnrollments(
        enrollments: Omit<Enrollment, 'id' | 'imported_at'>[]
    ): Promise<number> {
        if (enrollments.length === 0) return 0;

        const columns = [
            'semester_id', 'class_code', 'subject_name', 'is_practice',
            'practice_label', 'weekday', 'schedule', 'total_slots',
            'enrolled_students', 'available_slots', 'room',
        ];

        const values: unknown[] = [];
        const placeholders: string[] = [];

        enrollments.forEach((enrollment, index) => {
            const offset = index * columns.length;
            const rowPlaceholders = columns.map((_, i) => `$${offset + i + 1}`);
            placeholders.push(`(${rowPlaceholders.join(', ')})`);

            values.push(
                enrollment.semester_id,
                enrollment.class_code,
                enrollment.subject_name,
                enrollment.is_practice,
                enrollment.practice_label,
                enrollment.weekday,
                enrollment.schedule,
                enrollment.total_slots,
                enrollment.enrolled_students,
                enrollment.available_slots,
                enrollment.room,
            );
        });

        const sql = `
            INSERT INTO enrollments (${columns.join(', ')})
            VALUES ${placeholders.join(', ')}
            ON CONFLICT ON CONSTRAINT unique_enrollment_entry
            DO UPDATE SET
                total_slots = EXCLUDED.total_slots,
                enrolled_students = EXCLUDED.enrolled_students,
                available_slots = EXCLUDED.available_slots,
                schedule = EXCLUDED.schedule,
                practice_label = EXCLUDED.practice_label,
                imported_at = CURRENT_TIMESTAMP
        `;

        const result = await pool.query(sql, values);
        return result.rowCount ?? 0;
    }

    /**
     * Finds all enrollments for a semester, ordered by class_code and subject_name
     */
    async findBySemester(semesterId: number): Promise<Enrollment[]> {
        const result = await pool.query(
            `SELECT id, semester_id, class_code, subject_name, is_practice,
                    practice_label, weekday, schedule, total_slots,
                    enrolled_students, available_slots, room, imported_at
             FROM enrollments
             WHERE semester_id = $1
             ORDER BY class_code, subject_name`,
            [semesterId]
        );
        return result.rows as Enrollment[];
    }

    /**
     * Updates the room field for a specific enrollment
     */
    async updateRoom(enrollmentId: number, room: string): Promise<void> {
        await pool.query(
            'UPDATE enrollments SET room = $1 WHERE id = $2',
            [room, enrollmentId]
        );
    }
}
