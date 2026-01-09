 

/**
 * Migration: Create Queue Automation Tables
 * 
 * Creates tables for the queue idle automation feature:
 * - queue_automation_config: Stores automation configuration
 * - queue_automation_log: Tracks which leads have been contacted
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
    // ============================================
    // 1. TABELA: queue_automation_config
    // Configuração da automação de fila vazia
    // ============================================
    pgm.createTable('queue_automation_config', {
        id: 'id',
        template_id: {
            type: 'integer',
            references: 'templates(id)',
            onDelete: 'SET NULL'
        },
        target_status: {
            type: 'text',
            notNull: false,
            default: null
        },
        message_type: {
            type: 'text',
            notNull: true,
            default: 'fixed',
            check: "message_type IN ('fixed', 'ai')"
        },
        is_active: {
            type: 'boolean',
            notNull: true,
            default: false
        },
        start_hour: {
            type: 'integer',
            notNull: true,
            default: 8
        },
        end_hour: {
            type: 'integer',
            notNull: true,
            default: 21
        },
        created_at: {
            type: 'timestamp',
            default: pgm.func('CURRENT_TIMESTAMP')
        },
        updated_at: {
            type: 'timestamp',
            default: pgm.func('CURRENT_TIMESTAMP')
        }
    }, { ifNotExists: true });

    // ============================================
    // 2. TABELA: queue_automation_log
    // Log de leads já contactados pela automação
    // ============================================
    pgm.createTable('queue_automation_log', {
        id: 'id',
        lead_cpf: {
            type: 'text',
            notNull: true,
            references: 'leads(cpf)',
            onDelete: 'CASCADE'
        },
        template_id: { type: 'integer' },
        sent_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('CURRENT_TIMESTAMP')
        },
        success: {
            type: 'boolean',
            default: true
        },
        error_message: { type: 'text' }
    }, { ifNotExists: true });

    // Constraint: cada lead só pode ser contactado uma vez pela automação
    pgm.sql(`
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'unique_automation_lead'
            ) THEN
                ALTER TABLE queue_automation_log
                ADD CONSTRAINT unique_automation_lead UNIQUE (lead_cpf);
            END IF;
        END $$;
    `);

    // ============================================
    // INDEXES para Performance
    // ============================================
    pgm.createIndex('queue_automation_log', 'lead_cpf', {
        name: 'idx_queue_automation_log_lead',
        ifNotExists: true
    });

    pgm.createIndex('queue_automation_log', 'sent_at', {
        name: 'idx_queue_automation_log_sent_at',
        ifNotExists: true
    });

    // Inserir configuração padrão
    pgm.sql(`
        INSERT INTO queue_automation_config (template_id, message_type, is_active, start_hour, end_hour)
        VALUES (NULL, 'fixed', false, 8, 21)
        ON CONFLICT DO NOTHING;
    `);
};

exports.down = (pgm) => {
    pgm.dropTable('queue_automation_log', { ifExists: true, cascade: true });
    pgm.dropTable('queue_automation_config', { ifExists: true, cascade: true });
};
