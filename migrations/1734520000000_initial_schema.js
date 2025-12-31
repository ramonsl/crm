 

/**
 * Initial Schema Migration
 * 
 * Snapshot completo do schema atual do CRM
 * Inclui todas as 12 tabelas, indexes e foreign keys
 * 
 * IMPORTANTE: Esta migration é idempotente (IF NOT EXISTS)
 * Pode ser executada múltiplas vezes sem erro
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
    // ============================================
    // 1. TABELA: leads (PK: cpf)
    // ============================================
    pgm.createTable('leads', {
        cpf: { type: 'text', primaryKey: true },
        nome: { type: 'text' },
        email: { type: 'text' },
        telefone: { type: 'text' },
        tipo_ingresso: { type: 'text' },
        status: { type: 'text' },
        last_message: { type: 'text' },
        unread_count: { type: 'integer', default: 0 },
        last_message_time: { type: 'timestamp' },
        created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
        updated_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
        data_inscricao: { type: 'timestamp' },
        notes: { type: 'text' },
        profile_image: { type: 'text' },
        curso_interesse: { type: 'text' },
        escola: { type: 'text' },
        is_new: { type: 'integer', default: 0 },
        status_changed: { type: 'integer', default: 0 },
        status_changed_at: { type: 'timestamp' },
        last_import_date: { type: 'timestamp' },
        last_template_name: { type: 'text' },
        whatsapp_valido: { type: 'integer', default: 0 },
        profile_picture: { type: 'text' },
        last_template_sent: { type: 'text' },
        last_template_sent_at: { type: 'timestamp' }
    }, { ifNotExists: true });

    // ============================================
    // 2. TABELA: templates
    // ============================================
    pgm.createTable('templates', {
        id: 'id',
        name: { type: 'text', notNull: true },
        message: { type: 'text', notNull: true },
        type: { type: 'text', default: 'fixed' },
        created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
    }, { ifNotExists: true });

    // ============================================
    // 3. TABELA: settings
    // ============================================
    pgm.createTable('settings', {
        key: { type: 'text', primaryKey: true },
        value: { type: 'text' }
    }, { ifNotExists: true });

    // ============================================
    // 4. TABELA: system_notifications
    // ============================================
    pgm.createTable('system_notifications', {
        id: 'id',
        title: { type: 'text', notNull: true },
        message: { type: 'text', notNull: true },
        type: { type: 'text', default: 'info' },
        is_read: { type: 'integer', default: 0 },
        created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
    }, { ifNotExists: true });

    // ============================================
    // 5. TABELA: message_history
    // ============================================
    pgm.createTable('message_history', {
        id: 'id',
        contact_cpf: { type: 'text', notNull: true },
        template_id: { type: 'integer' },
        template_name: { type: 'text', notNull: true },
        message_content: { type: 'text', notNull: true },
        sent_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
        status: { type: 'text', default: 'sent' }
    }, { ifNotExists: true });

    // Foreign keys para message_history
    pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_message_history_contact'
      ) THEN
        ALTER TABLE message_history
        ADD CONSTRAINT fk_message_history_contact
        FOREIGN KEY (contact_cpf) REFERENCES leads(cpf) ON DELETE CASCADE;
      END IF;
    END $$;
  `);

    pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_message_history_template'
      ) THEN
        ALTER TABLE message_history
        ADD CONSTRAINT fk_message_history_template
        FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

    // ============================================
    // 6. TABELA: template_history
    // ============================================
    pgm.createTable('template_history', {
        id: 'id',
        phone: { type: 'text', notNull: true },
        template_name: { type: 'text', notNull: true },
        template_content: { type: 'text' },
        sent_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
        success: { type: 'boolean', default: true },
        error_message: { type: 'text' }
    }, { ifNotExists: true });

    // ============================================
    // 7. TABELA: statuses
    // ============================================
    pgm.createTable('statuses', {
        id: 'id',
        name: { type: 'text', notNull: true, unique: true },
        color: { type: 'text', notNull: true, default: '#6b7280' },
        display_order: { type: 'integer', notNull: true, default: 0 },
        active: { type: 'integer', notNull: true, default: 1 },
        created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
        updated_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
    }, { ifNotExists: true });

    // ============================================
    // 8. TABELA: users
    // ============================================
    pgm.createTable('users', {
        id: 'id',
        email: { type: 'text', notNull: true, unique: true },
        password_hash: { type: 'text', notNull: true },
        name: { type: 'text', notNull: true },
        role: { type: 'text', notNull: true, default: 'user' },
        active: { type: 'integer', notNull: true, default: 1 },
        created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
        updated_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
    }, { ifNotExists: true });

    // ============================================
    // 9. TABELA: sessions
    // ============================================
    pgm.createTable('sessions', {
        id: { type: 'text', primaryKey: true },
        user_id: { type: 'integer', notNull: true },
        expires_at: { type: 'timestamp', notNull: true },
        created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
    }, { ifNotExists: true });

    pgm.sql(`
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_session_user'
            ) THEN
                ALTER TABLE sessions
                ADD CONSTRAINT fk_session_user
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;
        END $$;
    `);

    // ============================================
    // 10. TABELA: activities
    // ============================================
    pgm.createTable('activities', {
        id: 'id',
        contact_cpf: { type: 'text', notNull: true },
        type: { type: 'text', notNull: true },
        subtype: { type: 'text' },
        title: { type: 'text', notNull: true },
        description: { type: 'text' },
        metadata: { type: 'text' },
        created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
    }, { ifNotExists: true });

    pgm.sql(`
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_activity_contact'
            ) THEN
                ALTER TABLE activities
                ADD CONSTRAINT fk_activity_contact
                FOREIGN KEY (contact_cpf) REFERENCES leads(cpf) ON DELETE CASCADE;
            END IF;
        END $$;
    `);

    // ============================================
    // 11. TABELA: messages
    // ============================================
    pgm.createTable('messages', {
        id: { type: 'text', primaryKey: true },
        contact_phone: { type: 'text', notNull: true },
        content: { type: 'text' },
        timestamp: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
        from_me: { type: 'boolean', default: false },
        type: { type: 'text', default: 'text' },
        media_url: { type: 'text' },
        read: { type: 'boolean', default: false }
    }, { ifNotExists: true });

    // ============================================
    // 12. TABELA: tags
    // ============================================
    pgm.createTable('tags', {
        id: 'id',
        name: { type: 'text', notNull: true, unique: true },
        color: { type: 'text', notNull: true, default: '#6b7280' },
        description: { type: 'text' },
        active: { type: 'integer', notNull: true, default: 1 },
        created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
        updated_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
    }, { ifNotExists: true });

    // ============================================
    // 13. TABELA: lead_tags (junction table)
    // ============================================
    pgm.createTable('lead_tags', {
        id: 'id',
        lead_cpf: { type: 'text', notNull: true },
        tag_id: { type: 'integer', notNull: true },
        created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
    }, { ifNotExists: true });

    pgm.sql(`
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_lead_tag_lead'
            ) THEN
                ALTER TABLE lead_tags
                ADD CONSTRAINT fk_lead_tag_lead
                FOREIGN KEY (lead_cpf) REFERENCES leads(cpf) ON DELETE CASCADE;
            END IF;
        END $$;
    `);

    pgm.sql(`
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_lead_tag_tag'
            ) THEN
                ALTER TABLE lead_tags
                ADD CONSTRAINT fk_lead_tag_tag
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;
            END IF;
        END $$;
    `);

    pgm.sql(`
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'unique_lead_tag'
            ) THEN
                ALTER TABLE lead_tags
                ADD CONSTRAINT unique_lead_tag UNIQUE (lead_cpf, tag_id);
            END IF;
        END $$;
    `);

    // ============================================
    // INDEXES para Performance
    // ============================================
    pgm.createIndex('message_history', 'contact_cpf', {
        name: 'idx_message_history_cpf',
        ifNotExists: true
    });

    pgm.createIndex('message_history', 'sent_at', {
        name: 'idx_message_history_sent_at',
        ifNotExists: true
    });

    pgm.createIndex('template_history', 'phone', {
        name: 'idx_template_history_phone',
        ifNotExists: true
    });

    pgm.createIndex('template_history', 'sent_at', {
        name: 'idx_template_history_sent_at',
        ifNotExists: true
    });

    pgm.createIndex('template_history', ['phone', 'sent_at'], {
        name: 'idx_template_history_phone_sent_at',
        ifNotExists: true
    });

    pgm.createIndex('activities', ['contact_cpf', 'created_at'], {
        name: 'idx_activities_contact',
        ifNotExists: true
    });

    pgm.createIndex('activities', 'type', {
        name: 'idx_activities_type',
        ifNotExists: true
    });

    pgm.createIndex('users', 'email', {
        name: 'idx_users_email',
        ifNotExists: true
    });

    pgm.createIndex('users', 'active', {
        name: 'idx_users_active',
        ifNotExists: true
    });

    pgm.createIndex('sessions', 'user_id', {
        name: 'idx_sessions_user_id',
        ifNotExists: true
    });

    pgm.createIndex('sessions', 'expires_at', {
        name: 'idx_sessions_expires_at',
        ifNotExists: true
    });

    pgm.createIndex('messages', 'contact_phone', {
        name: 'idx_messages_phone',
        ifNotExists: true
    });

    pgm.createIndex('messages', 'timestamp', {
        name: 'idx_messages_timestamp',
        ifNotExists: true
    });
};

exports.down = (pgm) => {
    // Rollback: Drop tudo na ordem inversa (respeitando foreign keys)
    pgm.dropTable('lead_tags', { ifExists: true, cascade: true });
    pgm.dropTable('tags', { ifExists: true, cascade: true });
    pgm.dropTable('messages', { ifExists: true, cascade: true });
    pgm.dropTable('activities', { ifExists: true, cascade: true });
    pgm.dropTable('sessions', { ifExists: true, cascade: true });
    pgm.dropTable('users', { ifExists: true, cascade: true });
    pgm.dropTable('statuses', { ifExists: true, cascade: true });
    pgm.dropTable('template_history', { ifExists: true, cascade: true });
    pgm.dropTable('message_history', { ifExists: true, cascade: true });
    pgm.dropTable('system_notifications', { ifExists: true, cascade: true });
    pgm.dropTable('settings', { ifExists: true, cascade: true });
    pgm.dropTable('templates', { ifExists: true, cascade: true });
    pgm.dropTable('leads', { ifExists: true, cascade: true });
};
