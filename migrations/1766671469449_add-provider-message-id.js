/**
 * Migration: Add provider_message_id to message_history
 * 
 * Adds a column to track external message IDs from providers like YCloud
 * for message status tracking.
 */

export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    // Add provider_message_id column to message_history
    pgm.addColumn('message_history', {
        provider_message_id: { type: 'varchar(255)' },
        provider: { type: 'varchar(50)', default: 'whatsappjs' },
        updated_at: { type: 'timestamp', default: pgm.func('NOW()') }
    }, { ifNotExists: true });

    // Create index for lookups by provider_message_id
    pgm.createIndex('message_history', 'provider_message_id', {
        name: 'idx_message_history_provider_msg_id',
        ifNotExists: true
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
    pgm.dropIndex('message_history', 'provider_message_id', {
        name: 'idx_message_history_provider_msg_id',
        ifExists: true
    });

    pgm.dropColumns('message_history', ['provider_message_id', 'provider', 'updated_at'], {
        ifExists: true
    });
};
