-- FCT/GoIP16 Port Yönetimi
-- Her port bir GSM hattını (SIM slot) temsil eder
-- Dahili (extension) bazlı port ataması yapılabilir

CREATE TABLE IF NOT EXISTS fct_ports (
  id SERIAL PRIMARY KEY,
  port_number INTEGER NOT NULL UNIQUE CHECK (port_number BETWEEN 1 AND 16),
  label VARCHAR(50) DEFAULT '',
  sim_number VARCHAR(20) DEFAULT '',
  operator VARCHAR(50) DEFAULT '',
  assigned_extension VARCHAR(10) DEFAULT NULL,
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16 port için başlangıç kayıtları
INSERT INTO fct_ports (port_number, label, enabled) VALUES
  (1, 'Port 1', true),
  (2, 'Port 2', false),
  (3, 'Port 3', false),
  (4, 'Port 4', false),
  (5, 'Port 5', false),
  (6, 'Port 6', false),
  (7, 'Port 7', false),
  (8, 'Port 8', false),
  (9, 'Port 9', false),
  (10, 'Port 10', false),
  (11, 'Port 11', false),
  (12, 'Port 12', false),
  (13, 'Port 13', false),
  (14, 'Port 14', false),
  (15, 'Port 15', false),
  (16, 'Port 16', false)
ON CONFLICT (port_number) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_fct_ports_extension ON fct_ports(assigned_extension);
CREATE INDEX IF NOT EXISTS idx_fct_ports_user ON fct_ports(assigned_user_id);
