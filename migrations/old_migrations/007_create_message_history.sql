-- Create message_history table for tracking sent messages
-- This table stores a history of all messages sent via the queue system

CREATE TABLE IF NOT EXISTS message_history (
    id SERIAL PRIMARY KEY,
    contact_cpf TEXT NOT NULL,
    template_id INTEGER,
    template_name TEXT NOT NULL,
    message_content TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'sent',
    CONSTRAINT fk_message_history_contact FOREIGN KEY (contact_cpf) REFERENCES leads(cpf) ON DELETE CASCADE,
    CONSTRAINT fk_message_history_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_history_cpf ON message_history(contact_cpf);
CREATE INDEX IF NOT EXISTS idx_message_history_sent_at ON message_history(sent_at DESC);

-- Comments
COMMENT ON TABLE message_history IS 'Tracks all messages sent through the queue system';
COMMENT ON COLUMN message_history.contact_cpf IS 'CPF of the contact who received the message';
COMMENT ON COLUMN message_history.template_id IS 'ID of the template used (nullable for custom messages)';
COMMENT ON COLUMN message_history.template_name IS 'Name of the template for reference';
COMMENT ON COLUMN message_history.message_content IS 'Actual message content sent';
COMMENT ON COLUMN message_history.status IS 'Message status: sent, failed, pending';
