/* eslint-disable @typescript-eslint/camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    // This is a dummy file to satisfy node-pg-migrate order check.
    // The migration 1768863961394 was already applied to the DB but the file was missing.
};

exports.down = pgm => {
};
