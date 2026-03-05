-- Müşteri sahipliği (agent bazlı görünürlük) için owner_id
ALTER TABLE customers ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id);

