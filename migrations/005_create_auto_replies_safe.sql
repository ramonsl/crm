-- Auto-Reply System Migration
-- Execute este SQL no SQL Editor do Neon Dashboard

-- Tabela de respostas automáticas
CREATE TABLE IF NOT EXISTS auto_replies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    intent_description TEXT NOT NULL,
    example_messages TEXT[] DEFAULT '{}',
    response_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    confidence_threshold DECIMAL(3, 2) DEFAULT 0.70,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de logs de respostas enviadas
CREATE TABLE IF NOT EXISTS auto_reply_logs (
    id SERIAL PRIMARY KEY,
    auto_reply_id INTEGER REFERENCES auto_replies(id) ON DELETE SET NULL,
    phone VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    detected_intent VARCHAR(255),
    confidence DECIMAL(3, 2),
    response_sent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_auto_replies_active ON auto_replies(is_active);
CREATE INDEX IF NOT EXISTS idx_auto_replies_priority ON auto_replies(priority);
CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_phone ON auto_reply_logs(phone);
CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_created ON auto_reply_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_intent ON auto_reply_logs(auto_reply_id);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at (dropa se existir e recria)
DROP TRIGGER IF EXISTS auto_replies_updated_at ON auto_replies;
CREATE TRIGGER auto_replies_updated_at
    BEFORE UPDATE ON auto_replies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Dados de exemplo para teste
INSERT INTO auto_replies (name, intent_description, example_messages, response_template, is_active, priority, confidence_threshold)
VALUES 
    ('Saudação', 'Cliente está cumprimentando, dizendo olá, oi, bom dia, boa tarde', 
     ARRAY['Olá', 'Oi', 'Bom dia', 'Boa tarde', 'Boa noite'], 
     'Olá {{name}}! 👋 Como posso ajudar você hoje?', 
     true, 0, 0.70),
    ('Agradecimento', 'Cliente está agradecendo', 
     ARRAY['Obrigado', 'Valeu', 'Muito obrigado', 'Thanks'], 
     'Por nada, {{name}}! 😊 Estou sempre à disposição!', 
     true, 0, 0.75)
ON CONFLICT DO NOTHING;
