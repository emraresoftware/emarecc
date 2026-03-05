-- Omnichannel: chat_sessions, interactions (CHAT, CALL, WHATSAPP)
-- Müşteri etkileşim geçmişi + Web Chat

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_name VARCHAR(100),
  visitor_email VARCHAR(150),
  visitor_identifier VARCHAR(255),
  customer_id UUID REFERENCES customers(id),
  status VARCHAR(20) DEFAULT 'waiting',
  assigned_agent_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent ON chat_sessions(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_customer ON chat_sessions(customer_id);

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id),
  type VARCHAR(20) NOT NULL,
  direction VARCHAR(20) DEFAULT 'inbound',
  content TEXT,
  agent_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactions_customer ON interactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON interactions(created_at);
