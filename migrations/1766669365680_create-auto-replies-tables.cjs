 

/**
 * Migration: Create auto_replies tables
 * 
 * Creates tables for the auto-reply system:
 * - auto_replies: Configuration for auto-reply intents
 * - auto_reply_logs: Activity logging
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
    // ============================================
    // 1. TABELA: auto_replies
    // Configuração de intenções para auto-resposta
    // ============================================
    pgm.createTable('auto_replies', {
        id: 'id',
        name: {
            type: 'varchar(255)',
            notNull: true
        },
        intent_description: {
            type: 'text',
            notNull: true
        },
        example_messages: {
            type: 'text[]',
            default: pgm.func("'{}'")
        },
        response_template: {
            type: 'text',
            notNull: true
        },
        is_active: {
            type: 'boolean',
            default: true
        },
        priority: {
            type: 'integer',
            default: 0
        },
        confidence_threshold: {
            type: 'decimal(3,2)',
            default: 0.70
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
    // 2. TABELA: auto_reply_logs
    // Log de atividades das auto-respostas
    // ============================================
    pgm.createTable('auto_reply_logs', {
        id: 'id',
        auto_reply_id: {
            type: 'integer',
            references: 'auto_replies(id)',
            onDelete: 'SET NULL'
        },
        phone: {
            type: 'varchar(50)',
            notNull: true
        },
        message: {
            type: 'text',
            notNull: true
        },
        detected_intent: {
            type: 'varchar(255)'
        },
        confidence: {
            type: 'decimal(3,2)'
        },
        response_sent: {
            type: 'text'
        },
        created_at: {
            type: 'timestamp',
            default: pgm.func('CURRENT_TIMESTAMP')
        }
    }, { ifNotExists: true });

    // ============================================
    // INDEXES para Performance
    // ============================================
    pgm.createIndex('auto_replies', 'is_active', {
        name: 'idx_auto_replies_is_active',
        ifNotExists: true
    });

    pgm.createIndex('auto_reply_logs', 'phone', {
        name: 'idx_auto_reply_logs_phone',
        ifNotExists: true
    });

    pgm.createIndex('auto_reply_logs', 'created_at', {
        name: 'idx_auto_reply_logs_created_at',
        ifNotExists: true
    });

    pgm.createIndex('auto_reply_logs', 'auto_reply_id', {
        name: 'idx_auto_reply_logs_auto_reply_id',
        ifNotExists: true
    });

    // ============================================
    // TRIGGER para updated_at
    // ============================================
    pgm.sql(`
        CREATE OR REPLACE FUNCTION update_auto_replies_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    `);

    pgm.sql(`
        DROP TRIGGER IF EXISTS auto_replies_updated_at ON auto_replies;
        CREATE TRIGGER auto_replies_updated_at
            BEFORE UPDATE ON auto_replies
            FOR EACH ROW
            EXECUTE FUNCTION update_auto_replies_updated_at()
    `);

    // ============================================
    // DADOS INICIAIS (intenções padrão)
    // ============================================
    pgm.sql(`
        INSERT INTO auto_replies (name, intent_description, example_messages, response_template, priority)
        SELECT 'Saudação', 
               'Cliente está cumprimentando, dizendo olá, oi, bom dia, boa tarde, boa noite', 
               ARRAY['Olá', 'Oi', 'Bom dia', 'Boa tarde', 'Boa noite', 'E aí'], 
               'Olá! 👋 Seja bem-vindo(a)! Como posso ajudar você hoje?',
               10
        WHERE NOT EXISTS (SELECT 1 FROM auto_replies WHERE name = 'Saudação')
    `);

    pgm.sql(`
        INSERT INTO auto_replies (name, intent_description, example_messages, response_template, priority)
        SELECT 'Agradecimento', 
               'Cliente está agradecendo, dizendo obrigado, valeu, thanks', 
               ARRAY['Obrigado', 'Valeu', 'Muito obrigado', 'Thanks', 'Obrigada'], 
               'Por nada! 😊 Estamos sempre à disposição. Se precisar de mais alguma coisa, é só chamar!',
               5
        WHERE NOT EXISTS (SELECT 1 FROM auto_replies WHERE name = 'Agradecimento')
    `);
};

exports.down = (pgm) => {
    pgm.dropTable('auto_reply_logs', { ifExists: true, cascade: true });
    pgm.sql('DROP TRIGGER IF EXISTS auto_replies_updated_at ON auto_replies');
    pgm.sql('DROP FUNCTION IF EXISTS update_auto_replies_updated_at()');
    pgm.dropTable('auto_replies', { ifExists: true, cascade: true });
};
