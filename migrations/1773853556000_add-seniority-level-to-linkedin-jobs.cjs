/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.addColumn('linkedin_jobs', {
        seniority_level: {
            type: 'varchar(20)',
            default: 'outros',
            notNull: true,
        },
    });

    pgm.createIndex('linkedin_jobs', 'seniority_level');
};

exports.down = (pgm) => {
    pgm.dropColumn('linkedin_jobs', 'seniority_level');
};
