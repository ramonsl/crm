/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    // 0. RESET: Drop existing table and columns to ensure clean schema (Feature is new)
    pgm.dropTable('ycloud_templates', { ifExists: true, cascade: true });
    pgm.dropColumns('messages', ['provider', 'template_id'], { ifExists: true });

    // 1. Create ycloud_templates table
    pgm.createTable('ycloud_templates', {
        id: { type: 'text', primaryKey: true },
        name: { type: 'text', notNull: true },
        language: { type: 'text', notNull: true },
        category: { type: 'text' },
        components: { type: 'jsonb', notNull: true },
        status: { type: 'text', notNull: true }, // APPROVED, REJECTED, PENDING
        last_synced: { type: 'timestamp', default: pgm.func('current_timestamp') },
        created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
        updated_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
    });

    // 2. Add provider and template_id to messages
    // provider: 'ycloud', 'baileys', 'wwebjs' (default 'baileys' for backward compatibility)
    pgm.addColumns('messages', {
        provider: { type: 'text', default: 'baileys' },
        template_id: {
            type: 'text',
            references: '"ycloud_templates"',
            onDelete: 'SET NULL',
            default: null
        }
    });

    // 3. Create index for faster template lookups
    pgm.createIndex('ycloud_templates', 'status');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumns('messages', ['provider', 'template_id']);
    pgm.dropTable('ycloud_templates');
};
