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
    // Create ycloud_templates table
    pgm.createTable('ycloud_templates', {
        id: 'id',
        template_name: { type: 'varchar(255)', notNull: true },
        friendly_name: { type: 'varchar(255)', notNull: true },
        category: { type: 'varchar(50)', notNull: true },
        language: { type: 'varchar(10)', default: 'pt_BR' },
        header_type: { type: 'varchar(20)' },
        header_content: { type: 'text' },
        body_text: { type: 'text', notNull: true },
        footer_text: { type: 'varchar(60)' },
        buttons: { type: 'jsonb' },
        variables: { type: 'jsonb' },
        status: { type: 'varchar(20)', default: 'draft' },
        ycloud_template_id: { type: 'varchar(255)' },
        rejection_reason: { type: 'text' },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
        updated_at: { type: 'timestamp', default: pgm.func('NOW()') }
    }, { ifNotExists: true });

    // Create unique index on template_name
    pgm.createIndex('ycloud_templates', 'template_name', { unique: true, ifNotExists: true });

    // Add YCloud settings
    pgm.sql(`
        INSERT INTO settings (key, value) VALUES 
            ('bulk_send_provider', 'whatsappjs'),
            ('ycloud_api_key', ''),
            ('ycloud_waba_id', ''),
            ('ycloud_phone_id', '')
        ON CONFLICT (key) DO NOTHING;
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    // Drop ycloud_templates table
    pgm.dropTable('ycloud_templates', { ifExists: true });

    // Remove YCloud settings
    pgm.sql(`
        DELETE FROM settings WHERE key IN (
            'bulk_send_provider',
            'ycloud_api_key',
            'ycloud_waba_id',
            'ycloud_phone_id'
        );
    `);
};
