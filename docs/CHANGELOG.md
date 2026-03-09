# Changelog

## [1.2.0] - 2026-03-08

### 🐛 Kritik Bug Düzeltmeleri

- **⚠️ Docker Hostname SIP.js Fix:** Docker container ID (`906da5a2be30`) hostname olarak kullanıldığında SIP.js Grammar parser ALL gelen INVITE'ları sessizce reddediyordu. `hostname: asterisk.local` eklenerek çözüldü. (SORUNLAR.md #14)
- **Hangup Butonu Fix:** React stale closure sorunu — `useRef` ile `stateRef` pattern uygulandı
- **WebRTC Çağrı Regresyonu Fix:** `ensureRegistered()` `isConnected()` kontrolü eklendi, eski session cleanup, `qualify_frequency=0`
- **AMI Auto-Reconnect:** Docker restart sonrası AMI bağlantısı kopunca exponential backoff ile otomatik yeniden bağlanma (2s→30s max)
- **Rate Limit Fix:** `max: 100` → `max: 3000`, `/api/v1/debug/*` muaf tutuldu

### ✨ İyileştirmeler

- **PJSIP Transport:** WSS/WS transportlarına `external_media_address`, `external_signaling_address`, `local_net` eklendi
- **Dialplan Ringing:** `from-pstn` context'ine `Ringing()` eklendi (GoIP16'ya 180 gönderimi)
- **Nginx Cache-Busting:** `index.html` için `no-cache` header eklendi
- **Logs Sayfası Yeniden Tasarım:** 3 tab (Backend, Asterisk Live, Debug), renkli seviye badge'leri, arama/filtre
- **Asterisk Live Logs:** `/debug/asterisk-logs` endpoint, `asterisk_logs` Docker volume

### 📋 Outbound Mimari Değişikliği

- **WebRTC Direct:** Giden aramalar artık AMI Originate yerine doğrudan SIP.js INVITE kullanıyor (browser → Asterisk → fct-trunk → GSM)

### 📄 Dokümantasyon

- `SORUNLAR.md`: 9 → 15 sorun + Kritik Kurallar bölümü eklendi
- `emarecc_hafiza.md`: Tech stack, çağrı akışları, Asterisk config, Docker hostname detayı güncellendi
- `DOSYA_YAPISI.md`: Yeni GoIP16 scriptleri ve eksik dosyalar eklendi

---

## [1.1.0] - 2026-03-07

### 🐛 FCT Gateway Fix (5-7 Mart)

- GoIP16 `sip_registrar` düzeltildi (78.47.33.186 → 192.168.1.64)
- AOR isim uyumsuzluğu düzeltildi (`fct-aor` → `fct-trunk`)
- Docker NAT: `external_signaling/media_address=192.168.1.64`, identify match `149.34.200.122`
- Dialplan prefix `G3687P07` kaldırıldı (Trunk Gateway Mode)
- GoIP16 yönetim scriptleri oluşturuldu (scripts/ klasörü)

---

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
