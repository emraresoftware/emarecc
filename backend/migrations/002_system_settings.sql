-- Migration: CRM webhook URL/secret admin panelden yapılandırılabilir
-- Çalıştırma: psql -U postgres -d callcenter_db -f backend/migrations/002_system_settings.sql
-- veya: docker-compose exec db psql -U postgres -d callcenter_db -c "$(cat backend/migrations/002_system_settings.sql)"

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
