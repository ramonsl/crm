/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
    // 1. Inserir flag de ativação do Workei (default: false)
    pgm.sql(`
        INSERT INTO settings (key, value)
        VALUES ('workei_enabled', 'false')
        ON CONFLICT (key) DO NOTHING;
    `);

    // 2. Inserir configuração de tempo limite do Workei (default: 48h)
    pgm.sql(`
        INSERT INTO settings (key, value)
        VALUES ('workei_filter_hours', '48')
        ON CONFLICT (key) DO NOTHING;
    `);
};

exports.down = (pgm) => {
    // Reverter as inserções
    pgm.sql(`
        DELETE FROM settings
        WHERE key IN ('workei_enabled', 'workei_filter_hours');
    `);
};
