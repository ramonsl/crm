 

exports.shorthands = undefined;

exports.up = pgm => {
    // Create cost_entries table for tracking expenses
    pgm.createTable('cost_entries', {
        id: 'id',
        service: { type: 'varchar(50)', notNull: true }, // 'openai', 'railway', 'ycloud'
        amount: { type: 'decimal(10,2)', notNull: true },
        currency: { type: 'varchar(3)', default: 'USD' },
        period_month: { type: 'integer', notNull: true }, // 1-12
        period_year: { type: 'integer', notNull: true },
        source: { type: 'varchar(20)', default: 'manual' }, // 'api', 'manual'
        description: { type: 'text' },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
        updated_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    // Add index for querying by service and period
    pgm.createIndex('cost_entries', ['service', 'period_year', 'period_month']);

    // Add unique constraint to prevent duplicate entries for same service/period
    pgm.addConstraint('cost_entries', 'unique_service_period', {
        unique: ['service', 'period_year', 'period_month']
    });
};

exports.down = pgm => {
    pgm.dropTable('cost_entries');
};
