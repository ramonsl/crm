/* eslint-disable @typescript-eslint/camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.sql(`
        ALTER TABLE messages 
        ADD COLUMN IF NOT EXISTS media_url TEXT,
        ADD COLUMN IF NOT EXISTS media_type VARCHAR(50);
    `);
};

exports.down = pgm => {
    pgm.sql(`
        ALTER TABLE messages 
        DROP COLUMN IF EXISTS media_url,
        DROP COLUMN IF EXISTS media_type;
    `);
};
