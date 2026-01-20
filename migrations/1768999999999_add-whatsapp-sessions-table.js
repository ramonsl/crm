/* eslint-disable @typescript-eslint/camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('whatsapp_sessions', {
        id: { type: 'varchar(255)', notNull: true },
        provider: { type: 'varchar(50)', notNull: true },
        key: { type: 'varchar(255)', notNull: true },
        value: { type: 'text', notNull: true }, // JSON content or Base64 string
        updated_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });

    // Composite Primary Key (id + provider + key) to ensure uniqueness
    pgm.addConstraint('whatsapp_sessions', 'pk_whatsapp_sessions', {
        primaryKey: ['id', 'provider', 'key'],
    });

    // Index on provider for fast lookups
    pgm.createIndex('whatsapp_sessions', 'provider');
    // Index on provider + id for clearing specific sessions
    pgm.createIndex('whatsapp_sessions', ['provider', 'id']);
};

exports.down = pgm => {
    pgm.dropTable('whatsapp_sessions');
};
