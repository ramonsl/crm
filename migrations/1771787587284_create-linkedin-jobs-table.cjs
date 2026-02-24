/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable('linkedin_jobs', {
        id: 'id',
        linkedin_post_id: { type: 'varchar(255)', notNull: true, unique: true },
        title: { type: 'varchar(255)', notNull: true },
        company: { type: 'varchar(255)', notNull: true },
        location: { type: 'varchar(255)' },
        is_remote: { type: 'boolean', default: false },
        raw_content: { type: 'text' },
        formatted_message: { type: 'text' },
        url: { type: 'text' },
        posted_at: { type: 'timestamp' },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
        status: { type: 'varchar(50)', default: 'pending' }, // pending, posted, rejected, error
        error_message: { type: 'text' }
    });

    pgm.createIndex('linkedin_jobs', 'linkedin_post_id');
    pgm.createIndex('linkedin_jobs', 'status');
};

exports.down = (pgm) => {
    pgm.dropTable('linkedin_jobs');
};
