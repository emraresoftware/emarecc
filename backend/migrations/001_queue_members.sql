-- Mevcut kurulumlar için: queue_members tablosu
-- docker-compose exec db psql -U postgres -d callcenter_db -f - < backend/migrations/001_queue_members.sql

CREATE TABLE IF NOT EXISTS queue_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_id UUID REFERENCES queues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  penalty INT DEFAULT 0,
  UNIQUE(queue_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_queue_members_queue ON queue_members(queue_id);
