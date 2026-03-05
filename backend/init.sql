-- OpenCC - Call Center Database Schema
-- Run on first PostgreSQL init

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE user_role AS ENUM ('admin', 'agent', 'supervisor');
CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE disposition_code AS ENUM (
  'payment_promise', 'refused', 'unreachable', 'busy', 'wrong_number'
);

-- 1. Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  extension VARCHAR(20) UNIQUE,
  role user_role NOT NULL DEFAULT 'agent',
  status VARCHAR(20) NOT NULL DEFAULT 'offline',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_extension ON users(extension);
CREATE INDEX idx_users_status ON users(status);

-- 2. Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number VARCHAR(30) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  notes TEXT,
  debt_amount DECIMAL(15,2),
  last_payment_date DATE,
  file_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone_number);

-- 3. Calls (CDR)
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asterisk_uniqueid VARCHAR(50),
  direction call_direction,
  caller_number VARCHAR(30),
  destination_number VARCHAR(30),
  agent_id UUID REFERENCES users(id),
  status VARCHAR(20),
  hangup_cause VARCHAR(50),
  disposition_code disposition_code,
  duration INT DEFAULT 0,
  recording_path VARCHAR(500),
  transcript TEXT,
  sentiment_score FLOAT,
  ai_summary TEXT,
  external_id VARCHAR(100),
  external_type VARCHAR(50),
  callback_url VARCHAR(500),
  started_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calls_agent ON calls(agent_id);
CREATE INDEX idx_calls_started ON calls(started_at);
CREATE INDEX idx_calls_external ON calls(external_id, external_type);

-- 4. Scripts
CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Queues
CREATE TABLE queues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  strategy VARCHAR(50) DEFAULT 'ring-all',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5b. Queue Members (ajan-kuyruk ataması)
CREATE TABLE queue_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_id UUID REFERENCES queues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  penalty INT DEFAULT 0,
  UNIQUE(queue_id, user_id)
);
CREATE INDEX idx_queue_members_queue ON queue_members(queue_id);

-- 6. Campaigns
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) DEFAULT 'preview',
  status VARCHAR(20) DEFAULT 'draft',
  queue_id UUID REFERENCES queues(id),
  script_id UUID REFERENCES scripts(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Campaign_Leads
CREATE TABLE campaign_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id),
  customer_id UUID REFERENCES customers(id),
  phone_number VARCHAR(30) NOT NULL,
  status VARCHAR(20) DEFAULT 'new',
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaign_leads_status ON campaign_leads(campaign_id, status);

-- 8. Agent_Skills
CREATE TABLE agent_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES users(id),
  skill VARCHAR(50) NOT NULL,
  level INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Customer Notes
CREATE TABLE customer_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  content TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. System Settings (key-value: crm_webhook_url, crm_webhook_secret)
CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 11. Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Seed: Run from backend/scripts/seed.js (creates admin/admin123)
