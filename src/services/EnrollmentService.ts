/**
 * Enrollment Service — Business logic for enrollment management
 *
 * Responsibilities:
 * - Parse XLS spreadsheet and extract enrollment data
 * - Orchestrate import (delete old + bulk insert)
 * - Build grid data grouped by weekday with practice mismatch detection
 */

import * as XLSX from 'xlsx';
import { EnrollmentRepository, IEnrollmentRepository } from '@/repositories/EnrollmentRepository';
import {
    Enrollment,
    ImportResult,
    Semester,
    WeekdayGrid,
    WEEKDAYS_ORDER,
} from '@/types/enrollment';

// ============================================================================
// Parsed Row (Internal)
// ============================================================================

interface ParsedEnrollmentRow {
    classCode: string;
    subjectName: string;
    isPractice: boolean;
    practiceLabel: string | null;
    weekday: string;
    schedule: string | null;
    totalSlots: number;
    enrolledStudents: number;
    availableSlots: number;
}

// ============================================================================
// Weekday Abbreviation Map (PT-BR)
// ============================================================================

const WEEKDAY_MAP: Record<string, string> = {
    'Seg': 'Seg',
    'Ter': 'Ter',
    'Qua': 'Qua',
    'Qui': 'Qui',
    'Sex': 'Sex',
    'Sáb': 'Sáb',
    'Sab': 'Sáb',
    'Dom': 'Dom',
};

// ============================================================================
// Service
// ============================================================================

export class EnrollmentService {
    private repository: IEnrollmentRepository;

    constructor(repository?: IEnrollmentRepository) {
        this.repository = repository ?? new EnrollmentRepository();
    }

    // ========================================================================
    // Semesters
    // ========================================================================

    async getSemesters(): Promise<Semester[]> {
        return this.repository.findSemesters();
    }

    async createSemester(code: string): Promise<Semester> {
        return this.repository.createSemester(code);
    }

    // ========================================================================
    // Import
    // ========================================================================

    /**
     * Imports enrollments from an XLS buffer for a given semester.
     * Deletes existing data for that semester before inserting.
     */
    async importEnrollments(semesterId: number, buffer: Buffer): Promise<ImportResult> {
        const errors: string[] = [];
        const parsed = this.parseSpreadsheet(buffer, errors);

        if (parsed.length === 0) {
            return {
                success: false,
                totalProcessed: 0,
                totalInserted: 0,
                errors: errors.length > 0 ? errors : ['Nenhum dado encontrado na planilha'],
            };
        }

        // Delete old data and re-import
        await this.repository.deleteEnrollmentsBySemester(semesterId);

        const enrollmentRows = parsed.map((row) => ({
            semester_id: semesterId,
            class_code: row.classCode,
            subject_name: row.subjectName,
            is_practice: row.isPractice,
            practice_label: row.practiceLabel,
            weekday: row.weekday,
            schedule: row.schedule,
            total_slots: row.totalSlots,
            enrolled_students: row.enrolledStudents,
            available_slots: row.availableSlots,
            room: null,
        }));

        const inserted = await this.repository.bulkInsertEnrollments(enrollmentRows);

        return {
            success: true,
            totalProcessed: parsed.length,
            totalInserted: inserted,
            errors,
        };
    }

    // ========================================================================
    // Grid Data
    // ========================================================================

    /**
     * Returns enrollment data grouped by weekday for the grid view.
     * Each item represents one theory subject with optional practice mismatch info.
     */
    async getEnrollmentGrid(semesterId: number): Promise<WeekdayGrid> {
        const enrollments = await this.repository.findBySemester(semesterId);

        // Group by classCode + subjectName (theory base name)
        const subjectMap = new Map<string, { theory: Enrollment | null; practice: Enrollment | null }>();

        for (const enrollment of enrollments) {
            const baseSubjectName = enrollment.is_practice
                ? this.extractTheoryName(enrollment.subject_name)
                : enrollment.subject_name;
            const key = `${enrollment.class_code}::${baseSubjectName}`;

            if (!subjectMap.has(key)) {
                subjectMap.set(key, { theory: null, practice: null });
            }

            const entry = subjectMap.get(key)!;
            if (enrollment.is_practice) {
                entry.practice = enrollment;
            } else {
                entry.theory = enrollment;
            }
        }

        // Build grid items
        const grid: WeekdayGrid = {};
        for (const day of WEEKDAYS_ORDER) {
            grid[day] = [];
        }

        for (const [, { theory, practice }] of subjectMap) {
            // Use theory if available, fallback to practice for subjects without theory
            const primary = theory ?? practice;
            if (!primary) continue;

            const weekday = theory?.weekday ?? practice?.weekday ?? '';
            if (!grid[weekday]) {
                grid[weekday] = [];
            }

            const hasPractice = practice !== null;
            const practiceEnrolled = practice?.enrolled_students ?? null;
            const hasPracticeMismatch = hasPractice && theory !== null
                ? theory.enrolled_students !== practice.enrolled_students
                : false;

            grid[weekday].push({
                id: primary.id,
                classCode: primary.class_code,
                subjectName: theory?.subject_name ?? this.extractTheoryName(primary.subject_name),
                weekday,
                schedule: primary.schedule,
                totalSlots: primary.total_slots,
                enrolledStudents: primary.enrolled_students,
                availableSlots: primary.available_slots,
                room: primary.room,
                hasPractice,
                practiceEnrolled,
                hasPracticeMismatch,
            });
        }

        // Sort each day's items by classCode
        for (const day of WEEKDAYS_ORDER) {
            grid[day].sort((a, b) => a.classCode.localeCompare(b.classCode));
        }

        return grid;
    }

    // ========================================================================
    // Room Update
    // ========================================================================

    async updateRoom(enrollmentId: number, room: string): Promise<void> {
        await this.repository.updateRoom(enrollmentId, room);
    }

    // ========================================================================
    // Spreadsheet Parsing (Internal)
    // ========================================================================

    /**
     * Parses the XLS buffer and extracts enrollment rows.
     *
     * Spreadsheet structure:
     * - Header rows repeated per turma group: [Turma, Sala, Disciplina, Vagas Ofertadas, ...]
     * - Turma name appears in first column of group header row
     * - Disciplina field contains: "NOME DA DISCIPLINA\r\nDias e Horários de Aula: Seg - 19:00 às 19:42"
     * - Practice rows have "- Prática 1" in the disciplina name
     */
    parseSpreadsheet(buffer: Buffer, errors: string[]): ParsedEnrollmentRow[] {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

        const result: ParsedEnrollmentRow[] = [];
        let currentTurma = '';

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i] as (string | number | null)[];
            if (!row || row.length < 5) continue;

            const firstCell = row[0]?.toString().trim() ?? '';
            const disciplinaCell = row[2]?.toString().trim() ?? '';

            // Skip header rows
            if (firstCell === 'Turma' || firstCell === 'TOTAL') continue;

            // Detect new turma group
            if (firstCell && firstCell.startsWith('TOR-')) {
                currentTurma = firstCell;
            }

            // Skip rows without discipline
            if (!disciplinaCell || !currentTurma) continue;

            try {
                const parsed = this.parseDisciplinaCell(disciplinaCell);
                if (!parsed) continue;

                const totalSlots = this.safeNumber(row[3]);
                const enrolledStudents = this.safeNumber(row[4]);
                const availableSlots = this.safeNumber(row[8]);

                result.push({
                    classCode: currentTurma,
                    subjectName: parsed.subjectName,
                    isPractice: parsed.isPractice,
                    practiceLabel: parsed.isPractice ? parsed.originalName : null,
                    weekday: parsed.weekday,
                    schedule: parsed.schedule,
                    totalSlots,
                    enrolledStudents,
                    availableSlots,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                errors.push(`Linha ${i + 1}: ${message}`);
            }
        }

        return result;
    }

    /**
     * Parses the discipline cell which contains both name and schedule info.
     * Format: "NOME DA DISCIPLINA\r\nDias e Horários de Aula: Seg - 19:00 às 19:42"
     */
    private parseDisciplinaCell(cell: string): {
        subjectName: string;
        originalName: string;
        isPractice: boolean;
        weekday: string;
        schedule: string | null;
    } | null {
        // Split by newline (handles both \r\n and \n)
        const parts = cell.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
        if (parts.length < 2) return null;

        const originalName = parts[0];
        const scheduleInfo = parts.find((p) => p.startsWith('Dias e Horários'));

        if (!scheduleInfo) return null;

        // Extract weekday and time from "Dias e Horários de Aula: Seg - 19:00 às 19:42"
        const scheduleMatch = scheduleInfo.match(/:\s*([\w\u00C0-\u024F]+)\s*-\s*(.+)/);
        if (!scheduleMatch) return null;

        const rawWeekday = scheduleMatch[1];
        const schedule = scheduleMatch[2].trim();
        const weekday = WEEKDAY_MAP[rawWeekday] ?? rawWeekday;

        // Detect if it's a practice
        const isPractice = /- Prática \d+/.test(originalName);
        const subjectName = isPractice
            ? this.extractTheoryName(originalName)
            : originalName;

        return { subjectName, originalName, isPractice, weekday, schedule };
    }

    /**
     * Extracts the theory name from a practice label.
     * "LÓGICA DE PROGRAMAÇÃO - Prática 1" → "LÓGICA DE PROGRAMAÇÃO"
     */
    private extractTheoryName(practiceLabel: string): string {
        return practiceLabel.replace(/\s*-\s*Prática\s*\d+.*$/, '').trim();
    }

    /**
     * Safely extracts a number from a cell value
     */
    private safeNumber(value: unknown): number {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = parseInt(value, 10);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }
}
