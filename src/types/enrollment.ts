import { z } from 'zod';

// ============================================================================
// Database Models
// ============================================================================

export interface Semester {
    id: number;
    code: string;
    active: boolean;
    created_at: string;
}

export interface Enrollment {
    id: number;
    semester_id: number;
    class_code: string;
    subject_name: string;
    is_practice: boolean;
    practice_label: string | null;
    weekday: string;
    schedule: string | null;
    total_slots: number;
    enrolled_students: number;
    available_slots: number;
    room: string | null;
    imported_at: string;
}

// ============================================================================
// UI Models
// ============================================================================

export interface EnrollmentGridItem {
    id: number;
    classCode: string;
    subjectName: string;
    weekday: string;
    schedule: string | null;
    totalSlots: number;
    enrolledStudents: number;
    availableSlots: number;
    room: string | null;
    hasPractice: boolean;
    practiceEnrolled: number | null;
    hasPracticeMismatch: boolean;
}

export type WeekdayGrid = Record<string, EnrollmentGridItem[]>;

export interface ImportResult {
    success: boolean;
    totalProcessed: number;
    totalInserted: number;
    errors: string[];
}

// ============================================================================
// Zod Schemas — Validação de Payloads
// ============================================================================

export const semesterQuerySchema = z.object({
    semesterId: z.coerce.number().int().positive(),
});

export const createSemesterSchema = z.object({
    code: z
        .string()
        .min(3, 'Código do semestre deve ter pelo menos 3 caracteres')
        .max(20, 'Código do semestre deve ter no máximo 20 caracteres')
        .regex(/^\d{4}\/\d$/, 'Formato inválido. Use: YYYY/N (ex: 2026/1)'),
});

export const updateRoomSchema = z.object({
    enrollmentId: z.number().int().positive(),
    room: z.string().max(100, 'Sala deve ter no máximo 100 caracteres'),
});

// ============================================================================
// Weekday constants
// ============================================================================

export const WEEKDAYS_ORDER = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

export const WEEKDAY_LABELS: Record<string, string> = {
    'Seg': 'Segunda-feira',
    'Ter': 'Terça-feira',
    'Qua': 'Quarta-feira',
    'Qui': 'Quinta-feira',
    'Sex': 'Sexta-feira',
    'Sáb': 'Sábado',
};
