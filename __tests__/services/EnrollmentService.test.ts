/**
 * EnrollmentService Unit Tests
 *
 * Tests spreadsheet parsing, grid building, and practice mismatch detection.
 */

import { EnrollmentService } from '@/services/EnrollmentService';
import { IEnrollmentRepository } from '@/repositories/EnrollmentRepository';
import { Enrollment, Semester } from '@/types/enrollment';
import * as XLSX from 'xlsx';

// ============================================================================
// Mock Repository
// ============================================================================

function createMockRepository(overrides: Partial<IEnrollmentRepository> = {}): IEnrollmentRepository {
    return {
        findSemesters: jest.fn().mockResolvedValue([]),
        createSemester: jest.fn().mockResolvedValue({ id: 1, code: '2026/1', active: true, created_at: '' }),
        deleteEnrollmentsBySemester: jest.fn().mockResolvedValue(0),
        bulkInsertEnrollments: jest.fn().mockResolvedValue(0),
        findBySemester: jest.fn().mockResolvedValue([]),
        updateRoom: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

// ============================================================================
// Helper: create mock XLS buffer
// ============================================================================

function createMockXlsBuffer(rows: (string | number | null)[][]): Buffer {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Alunos');
    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xls' }));
}

// ============================================================================
// Tests
// ============================================================================

describe('EnrollmentService', () => {
    let service: EnrollmentService;
    let mockRepo: IEnrollmentRepository;

    beforeEach(() => {
        mockRepo = createMockRepository();
        service = new EnrollmentService(mockRepo);
    });

    // ========================================================================
    // Semesters
    // ========================================================================

    describe('getSemesters', () => {
        it('deve retornar a lista de semestres do repository', async () => {
            const semesters: Semester[] = [
                { id: 1, code: '2026/1', active: true, created_at: '2026-01-01' },
            ];
            (mockRepo.findSemesters as jest.Mock).mockResolvedValue(semesters);

            const result = await service.getSemesters();

            expect(result).toEqual(semesters);
            expect(mockRepo.findSemesters).toHaveBeenCalledTimes(1);
        });
    });

    describe('createSemester', () => {
        it('deve criar um novo semestre', async () => {
            const expected: Semester = { id: 2, code: '2026/2', active: true, created_at: '' };
            (mockRepo.createSemester as jest.Mock).mockResolvedValue(expected);

            const result = await service.createSemester('2026/2');

            expect(result).toEqual(expected);
            expect(mockRepo.createSemester).toHaveBeenCalledWith('2026/2');
        });
    });

    // ========================================================================
    // Spreadsheet Parsing
    // ========================================================================

    describe('parseSpreadsheet', () => {
        it('deve extrair disciplinas teóricas e práticas da planilha', () => {
            const rows = [
                ['Turma', 'Sala', 'Disciplina', 'Vagas Ofertadas', 'Total de Alunos Enturmados', 'Pagos', 'Regular', 'Dependência', 'Total Disponível'],
                ['TOR-ADS-1A-2026/1', null, 'LÓGICA DE PROGRAMAÇÃO\r\nDias e Horários de Aula: Qua - 19:00 às 19:42', 20, 18, 18, 14, 4, 2],
                [null, null, 'LÓGICA DE PROGRAMAÇÃO - Prática 1\r\nDias e Horários de Aula: Qua - 19:42 às 22:00', 20, 16, 16, 12, 4, 4],
            ];

            const buffer = createMockXlsBuffer(rows);
            const errors: string[] = [];
            const result = service.parseSpreadsheet(buffer, errors);

            expect(errors).toHaveLength(0);
            expect(result).toHaveLength(2);

            // Teórica
            expect(result[0]).toMatchObject({
                classCode: 'TOR-ADS-1A-2026/1',
                subjectName: 'LÓGICA DE PROGRAMAÇÃO',
                isPractice: false,
                weekday: 'Qua',
                schedule: '19:00 às 19:42',
                totalSlots: 20,
                enrolledStudents: 18,
                availableSlots: 2,
            });

            // Prática
            expect(result[1]).toMatchObject({
                classCode: 'TOR-ADS-1A-2026/1',
                subjectName: 'LÓGICA DE PROGRAMAÇÃO',
                isPractice: true,
                practiceLabel: 'LÓGICA DE PROGRAMAÇÃO - Prática 1',
                weekday: 'Qua',
                totalSlots: 20,
                enrolledStudents: 16,
            });
        });

        it('deve propagar o código da turma para linhas subsequentes', () => {
            const rows = [
                ['Turma', 'Sala', 'Disciplina', 'Vagas', 'Enturmados', null, null, null, 'Disponível'],
                ['TOR-ADS-2A-2026/1', null, 'BANCO DE DADOS\r\nDias e Horários de Aula: Qui - 19:00 às 20:24', 15, 14, null, null, null, 1],
                [null, null, 'PROCESSOS DE ENG\r\nDias e Horários de Aula: Seg - 19:00 às 20:24', 20, 13, null, null, null, 7],
            ];

            const buffer = createMockXlsBuffer(rows);
            const errors: string[] = [];
            const result = service.parseSpreadsheet(buffer, errors);

            expect(result).toHaveLength(2);
            expect(result[0].classCode).toBe('TOR-ADS-2A-2026/1');
            expect(result[1].classCode).toBe('TOR-ADS-2A-2026/1');
        });

        it('deve ignorar linhas de cabeçalho e TOTAL', () => {
            const rows = [
                ['Turma', 'Sala', 'Disciplina', 'Vagas', 'Enturmados', null, null, null, 'Disponível'],
                ['TOR-ADS-1A-2026/1', null, 'UX/UI DESIGN\r\nDias e Horários de Aula: Qui - 19:00 às 19:42', 27, 26, null, null, null, 1],
                ['Turma', 'Sala', 'Disciplina', 'Vagas', 'Enturmados', null, null, null, 'Disponível'],
                ['TOTAL', null, null, 1656, 1387, null, null, null, 269],
            ];

            const buffer = createMockXlsBuffer(rows);
            const errors: string[] = [];
            const result = service.parseSpreadsheet(buffer, errors);

            expect(result).toHaveLength(1);
            expect(result[0].subjectName).toBe('UX/UI DESIGN');
        });

        it('deve retornar array vazio para planilha sem dados válidos', () => {
            const rows = [
                ['Turma', 'Sala', 'Disciplina'],
                ['TOTAL', null, null],
            ];

            const buffer = createMockXlsBuffer(rows);
            const errors: string[] = [];
            const result = service.parseSpreadsheet(buffer, errors);

            expect(result).toHaveLength(0);
        });
    });

    // ========================================================================
    // Import
    // ========================================================================

    describe('importEnrollments', () => {
        it('deve deletar dados antigos e inserir novos', async () => {
            const rows = [
                ['Turma', 'Sala', 'Disciplina', 'Vagas', 'Enturmados', null, null, null, 'Disponível'],
                ['TOR-ADS-1A-2026/1', null, 'LÓGICA\r\nDias e Horários de Aula: Seg - 19:00 às 20:00', 20, 18, null, null, null, 2],
            ];
            const buffer = createMockXlsBuffer(rows);
            (mockRepo.bulkInsertEnrollments as jest.Mock).mockResolvedValue(1);

            const result = await service.importEnrollments(1, buffer);

            expect(result.success).toBe(true);
            expect(result.totalProcessed).toBe(1);
            expect(mockRepo.deleteEnrollmentsBySemester).toHaveBeenCalledWith(1);
            expect(mockRepo.bulkInsertEnrollments).toHaveBeenCalledTimes(1);
        });

        it('deve retornar erro quando planilha está vazia', async () => {
            const rows = [['Turma', 'Sala', 'Disciplina']];
            const buffer = createMockXlsBuffer(rows);

            const result = await service.importEnrollments(1, buffer);

            expect(result.success).toBe(false);
            expect(result.errors).toContain('Nenhum dado encontrado na planilha');
            expect(mockRepo.deleteEnrollmentsBySemester).not.toHaveBeenCalled();
        });
    });

    // ========================================================================
    // Grid
    // ========================================================================

    describe('getEnrollmentGrid', () => {
        it('deve agrupar disciplinas por dia da semana', async () => {
            const enrollments: Enrollment[] = [
                {
                    id: 1, semester_id: 1, class_code: 'TOR-ADS-1A-2026/1',
                    subject_name: 'LÓGICA DE PROGRAMAÇÃO', is_practice: false,
                    practice_label: null, weekday: 'Qua', schedule: '19:00 às 19:42',
                    total_slots: 20, enrolled_students: 18, available_slots: 2,
                    room: null, imported_at: '',
                },
                {
                    id: 2, semester_id: 1, class_code: 'TOR-ADS-1A-2026/1',
                    subject_name: 'LÓGICA DE PROGRAMAÇÃO', is_practice: true,
                    practice_label: 'LÓGICA DE PROGRAMAÇÃO - Prática 1', weekday: 'Qua',
                    schedule: '19:42 às 22:00', total_slots: 20,
                    enrolled_students: 16, available_slots: 4,
                    room: null, imported_at: '',
                },
                {
                    id: 3, semester_id: 1, class_code: 'TOR-ADS-1A-2026/1',
                    subject_name: 'UX/UI DESIGN', is_practice: false,
                    practice_label: null, weekday: 'Qui', schedule: '19:00 às 19:42',
                    total_slots: 27, enrolled_students: 26, available_slots: 1,
                    room: 'Lab 01', imported_at: '',
                },
            ];

            (mockRepo.findBySemester as jest.Mock).mockResolvedValue(enrollments);

            const grid = await service.getEnrollmentGrid(1);

            // Quarta tem 1 item (teoria + prática agrupados)
            expect(grid['Qua']).toHaveLength(1);
            expect(grid['Qua'][0].subjectName).toBe('LÓGICA DE PROGRAMAÇÃO');
            expect(grid['Qua'][0].hasPractice).toBe(true);
            expect(grid['Qua'][0].hasPracticeMismatch).toBe(true);
            expect(grid['Qua'][0].practiceEnrolled).toBe(16);

            // Quinta tem 1 item (sem prática)
            expect(grid['Qui']).toHaveLength(1);
            expect(grid['Qui'][0].subjectName).toBe('UX/UI DESIGN');
            expect(grid['Qui'][0].hasPractice).toBe(false);
            expect(grid['Qui'][0].hasPracticeMismatch).toBe(false);
            expect(grid['Qui'][0].room).toBe('Lab 01');
        });

        it('deve detectar divergência entre teoria e prática', async () => {
            const enrollments: Enrollment[] = [
                {
                    id: 1, semester_id: 1, class_code: 'T1',
                    subject_name: 'FRONT-END', is_practice: false,
                    practice_label: null, weekday: 'Seg',
                    schedule: '19:00', total_slots: 28,
                    enrolled_students: 25, available_slots: 3,
                    room: null, imported_at: '',
                },
                {
                    id: 2, semester_id: 1, class_code: 'T1',
                    subject_name: 'FRONT-END', is_practice: true,
                    practice_label: 'FRONT-END - Prática 1', weekday: 'Seg',
                    schedule: '19:42', total_slots: 28,
                    enrolled_students: 22, available_slots: 6,
                    room: null, imported_at: '',
                },
            ];

            (mockRepo.findBySemester as jest.Mock).mockResolvedValue(enrollments);
            const grid = await service.getEnrollmentGrid(1);

            expect(grid['Seg'][0].hasPracticeMismatch).toBe(true);
            expect(grid['Seg'][0].enrolledStudents).toBe(25);
            expect(grid['Seg'][0].practiceEnrolled).toBe(22);
        });

        it('não deve marcar divergência quando os números são iguais', async () => {
            const enrollments: Enrollment[] = [
                {
                    id: 1, semester_id: 1, class_code: 'T1',
                    subject_name: 'BD SQL', is_practice: false,
                    practice_label: null, weekday: 'Ter',
                    schedule: '19:00', total_slots: 15,
                    enrolled_students: 14, available_slots: 1,
                    room: null, imported_at: '',
                },
                {
                    id: 2, semester_id: 1, class_code: 'T1',
                    subject_name: 'BD SQL', is_practice: true,
                    practice_label: 'BD SQL - Prática 1', weekday: 'Ter',
                    schedule: '20:36', total_slots: 15,
                    enrolled_students: 14, available_slots: 1,
                    room: null, imported_at: '',
                },
            ];

            (mockRepo.findBySemester as jest.Mock).mockResolvedValue(enrollments);
            const grid = await service.getEnrollmentGrid(1);

            expect(grid['Ter'][0].hasPracticeMismatch).toBe(false);
            expect(grid['Ter'][0].hasPractice).toBe(true);
        });

        it('deve retornar grid vazio quando não há enturmações', async () => {
            (mockRepo.findBySemester as jest.Mock).mockResolvedValue([]);
            const grid = await service.getEnrollmentGrid(1);

            expect(grid['Seg']).toHaveLength(0);
            expect(grid['Ter']).toHaveLength(0);
            expect(grid['Qua']).toHaveLength(0);
            expect(grid['Qui']).toHaveLength(0);
            expect(grid['Sex']).toHaveLength(0);
            expect(grid['Sáb']).toHaveLength(0);
        });
    });

    // ========================================================================
    // Room Update
    // ========================================================================

    describe('updateRoom', () => {
        it('deve delegar ao repository', async () => {
            await service.updateRoom(1, 'Lab 01');
            expect(mockRepo.updateRoom).toHaveBeenCalledWith(1, 'Lab 01');
        });
    });
});
