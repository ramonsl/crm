-- Migration 008: Create tags tables
-- Creates tags system with many-to-many relationship between leads and tags

-- Table: tags
-- Stores tag definitions (name, color, etc)
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active INTEGER DEFAULT 1
);

-- Table: lead_tags
-- Junction table for many-to-many relationship between leads and tags
CREATE TABLE IF NOT EXISTS lead_tags (
    id SERIAL PRIMARY KEY,
    lead_cpf TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lead_tags_lead FOREIGN KEY (lead_cpf) REFERENCES leads(cpf) ON DELETE CASCADE,
    CONSTRAINT fk_lead_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    CONSTRAINT unique_lead_tag UNIQUE(lead_cpf, tag_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_active ON tags(active);
CREATE INDEX IF NOT EXISTS idx_lead_tags_cpf ON lead_tags(lead_cpf);
CREATE INDEX IF NOT EXISTS idx_lead_tags_tag_id ON lead_tags(tag_id);

-- Seed some default tags
INSERT INTO tags (name, color, description) VALUES
    ('VIP', '#ef4444', 'Cliente VIP com alta prioridade'),
    ('Urgente', '#f59e0b', 'Necessita atendimento urgente'),
    ('Potencial Alto', '#10b981', 'Alto potencial de conversão'),
    ('Follow-up', '#3b82f6', 'Aguardando retorno'),
    ('Primeiro Contato', '#8b5cf6', 'Primeira interação com o lead')
ON CONFLICT (name) DO NOTHING;
