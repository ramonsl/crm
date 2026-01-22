/**
 * Migration: Create status_templates table
 * 
 * Associates each status with a template from the existing `templates` table.
 * This enables automatic message sending when leads change to specific statuses.
 */

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    // Create status_templates table
    pgm.createTable('status_templates', {
        id: 'id', // SERIAL PRIMARY KEY
        status_name: {
            type: 'text',
            notNull: true,
            unique: true,
            comment: 'Name of the status (must match statuses.name)'
        },
        template_id: {
            type: 'integer',
            references: '"templates"',
            onDelete: 'SET NULL',
            comment: 'Foreign key to templates.id'
        },
        is_active: {
            type: 'boolean',
            notNull: true,
            default: true,
            comment: 'Whether automation is enabled for this status'
        },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('NOW()')
        }
    }, {
        ifNotExists: true,
        comment: 'Associates each lead status with an automated message template'
    });

    // Create index for faster lookups
    pgm.createIndex('status_templates', 'status_name', { ifNotExists: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
    pgm.dropTable('status_templates', { ifExists: true });
};
