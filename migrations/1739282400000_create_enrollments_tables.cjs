/* eslint-disable @typescript-eslint/camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
    // Tabela de semestres letivos
    pgm.createTable('semesters', {
        id: { type: 'serial', primaryKey: true },
        code: { type: 'varchar(20)', notNull: true, unique: true },
        active: { type: 'boolean', notNull: true, default: true },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });

    // Tabela de enturmações (dados importados da planilha)
    pgm.createTable('enrollments', {
        id: { type: 'serial', primaryKey: true },
        semester_id: {
            type: 'integer',
            notNull: true,
            references: 'semesters(id)',
            onDelete: 'CASCADE',
        },
        class_code: { type: 'varchar(50)', notNull: true },
        subject_name: { type: 'varchar(200)', notNull: true },
        is_practice: { type: 'boolean', notNull: true, default: false },
        practice_label: { type: 'varchar(200)' },
        weekday: { type: 'varchar(10)', notNull: true },
        schedule: { type: 'varchar(100)' },
        total_slots: { type: 'integer', notNull: true, default: 0 },
        enrolled_students: { type: 'integer', notNull: true, default: 0 },
        available_slots: { type: 'integer', notNull: true, default: 0 },
        room: { type: 'varchar(100)' },
        imported_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });

    // Constraint de unicidade para evitar duplicatas na importação
    pgm.addConstraint('enrollments', 'unique_enrollment_entry', {
        unique: ['semester_id', 'class_code', 'subject_name', 'is_practice'],
    });

    // Índices de performance
    pgm.createIndex('enrollments', 'semester_id', { name: 'idx_enrollments_semester' });
    pgm.createIndex('enrollments', ['semester_id', 'weekday'], { name: 'idx_enrollments_weekday' });
    pgm.createIndex('enrollments', ['semester_id', 'subject_name'], { name: 'idx_enrollments_subject' });

    // Semestre padrão 2026/1
    pgm.sql("INSERT INTO semesters (code) VALUES ('2026/1')");
};

exports.down = (pgm) => {
    pgm.dropTable('enrollments');
    pgm.dropTable('semesters');
};
