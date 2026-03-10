/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable('message_idempotency', {
        key: { type: 'varchar(255)', primaryKey: true },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
        expires_at: { type: 'timestamp', notNull: true },
        metadata: { type: 'jsonb' },
    });

    pgm.createIndex('message_idempotency', 'expires_at');
};

exports.down = (pgm) => {
    pgm.dropTable('message_idempotency');
};
