/**
 * Migration: Create status_message_log table
 * 
 * Tracks which automated messages have been sent for each lead+status combination.
 * Prevents duplicate sends when a lead cycles back to the same status.
 */

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    // Create status_message_log table
    pgm.createTable('status_message_log', {
        id: 'id', // SERIAL PRIMARY KEY
        contact_cpf: {
            type: 'text',
            notNull: true,
            references: '"leads"(cpf)',
            onDelete: 'CASCADE',
            comment: 'CPF of the lead'
        },
        status_name: {
            type: 'text',
            notNull: true,
            comment: 'Status that triggered the message'
        },
        template_id: {
            type: 'integer',
            comment: 'Template used for the message'
        },
        message_id: {
            type: 'text',
            comment: 'ID of the message in the queue/WhatsApp'
        },
        sent_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('NOW()'),
            comment: 'When the message was queued/sent'
        }
    }, {
        ifNotExists: true,
        comment: 'Tracks automated messages sent per lead+status to prevent duplicates'
    });

    // Unique constraint: only one message per CPF+status
    pgm.addConstraint('status_message_log', 'unique_cpf_status', {
        unique: ['contact_cpf', 'status_name']
    });

    // Indexes for common queries
    pgm.createIndex('status_message_log', 'contact_cpf', { ifNotExists: true });
    pgm.createIndex('status_message_log', 'status_name', { ifNotExists: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
    pgm.dropTable('status_message_log', { ifExists: true });
};
