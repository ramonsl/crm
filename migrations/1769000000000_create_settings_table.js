/* eslint-disable @typescript-eslint/camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    // Create settings table if not exists (using manual SQL check logic inside pgm abstraction usually handles this with 'ifNotExists: true' but let's be explicit or standard)
    pgm.createTable('settings', {
        key: { type: 'varchar(255)', notNull: true, primaryKey: true },
        value: { type: 'text', notNull: true },
        description: { type: 'text' },
        updated_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    }, {
        ifNotExists: true
    });
};

exports.down = pgm => {
    pgm.dropTable('settings');
};
