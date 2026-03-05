-- Ses kayıtlarını kişi kartına bağlamak için customer_id
ALTER TABLE calls ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_calls_customer ON calls(customer_id);
