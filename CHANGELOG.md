# Changelog

## [1.0.0] - 2025-02-17

### Eklenen Özellikler

- **Kimlik Doğrulama:** JWT, login/logout, rol tabanlı erişim (admin, supervisor, agent)
- **Müşteri Yönetimi:** CRUD, notlar, borç alanları, CallerID arama
- **Screen Pop:** CallerID eşleme, bilinmeyen arayan formu, disposition kodları, callback_url ile CRM sayfası açma
- **Tahsilat Modu:** Scriptler, placeholder destek, Preview Dialer kampanya yönetimi
- **Click-to-Call:** AMI Originate ile giden arama, müşteri kartından Ara
- **Wallboard:** Realtime ajan durumları (WebSocket), Public/TV modu (token ile)
- **CDR Raporları:** Filtreleme, CSV indirme, ses kaydı playback
- **Admin Panel:** Kullanıcılar, kuyruklar, kampanyalar, scriptler, CRM webhook yapılandırması
- **CRM Entegrasyonu:** Webhook (Hangup → POST), external_id/type, recording_url
- **Ses Kayıtları:** MixMonitor, playback endpoint ve UI
- **IVR:** Basit ivr-main context (1=Destek, 2=Satış)
- **Production:** Nginx HTTPS/WSS, docker-compose.prod

### Teknik

- PostgreSQL, Redis, Asterisk AMI, Socket.io
- Rate limiting, Zod validation, Winston logging
- Docker multi-stage build
- Playwright E2E (login)
