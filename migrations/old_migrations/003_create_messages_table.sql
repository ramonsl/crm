-- Chat Feature: Messages Table
-- Stores all WhatsApp messages (incoming and outgoing) for registered contacts

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_cpf TEXT NOT NULL,
    message_id TEXT UNIQUE, -- WhatsApp message ID
    direction TEXT NOT NULL CHECK(direction IN ('incoming', 'outgoing')),
    body TEXT,
    media_url TEXT,
    media_type TEXT, -- 'image', 'video', 'document', 'audio'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'delivered', 'read', 'failed')),
    FOREIGN KEY (contact_cpf) REFERENCES leads(cpf) ON DELETE CASCADE
);

-- Index for faster queries by contact
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_cpf, timestamp DESC);

-- Index for message ID lookups
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);
