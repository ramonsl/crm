-- Auto-Reply System Tables
-- Created: 2025-12-12

-- Table for storing auto-reply configurations
CREATE TABLE IF NOT EXISTS auto_replies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  intent_description TEXT NOT NULL,
  example_messages TEXT[] DEFAULT '{}',
  response_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  confidence_threshold DECIMAL(3,2) DEFAULT 0.70,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for logging auto-reply activity
CREATE TABLE IF NOT EXISTS auto_reply_logs (
  id SERIAL PRIMARY KEY,
  auto_reply_id INTEGER REFERENCES auto_replies(id) ON DELETE SET NULL,
  phone VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  detected_intent VARCHAR(255),
  confidence DECIMAL(3,2),
  response_sent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_phone ON auto_reply_logs(phone);
CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_created_at ON auto_reply_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_auto_reply_id ON auto_reply_logs(auto_reply_id);
CREATE INDEX IF NOT EXISTS idx_auto_replies_is_active ON auto_replies(is_active);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_auto_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_replies_updated_at
    BEFORE UPDATE ON auto_replies
    FOR EACH ROW
    EXECUTE FUNCTION update_auto_replies_updated_at();

-- Insert default auto-replies for testing
INSERT INTO auto_replies (name, intent_description, example_messages, response_template, priority) VALUES
('Saudação', 
 'Cliente está cumprimentando, dizendo olá, oi, bom dia, boa tarde, boa noite', 
 ARRAY['Olá', 'Oi', 'Bom dia', 'Boa tarde', 'Boa noite', 'E aí'], 
 'Olá! 👋 Seja bem-vindo(a)! Como posso ajudar você hoje?',
 10),
('Agradecimento', 
 'Cliente está agradecendo, dizendo obrigado, valeu, thanks', 
 ARRAY['Obrigado', 'Valeu', 'Muito obrigado', 'Thanks', 'Obrigada'], 
 'Por nada! 😊 Estamos sempre à disposição. Se precisar de mais alguma coisa, é só chamar!',
 5);
