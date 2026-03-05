# Geliştirme Yol Haritası

OpenCC projesinin faz bazlı geliştirme planı.

---

## Faz 0: Hazırlık (Tamamlandı ✓)
- [x] Dokümantasyon oluşturma (REQUIREMENTS, USER_STORIES, API_SPEC, UI_SCREENS)
- [x] Mimari kararlar (ARCHITECTURE.md)
- [x] Veritabanı şeması (DATABASE_SCHEMA.md)
- [x] Kurulum rehberi taslağı (SETUP_GUIDE.md)

---

## Faz 1: Altyapı ve Çekirdek (2-3 hafta) ✓

### 1.1 Proje İskeleti
- [x] Monorepo veya klasör yapısı: `backend/`, `frontend/`, `asterisk_config/`, `docker/`
- [x] `docker-compose.yml` taslağı (PostgreSQL, Redis, Backend, Frontend)
- [x] Backend: Node.js + Express kurulumu
- [x] Frontend: React + Vite + Material UI kurulumu
- [x] `.env.example` ve environment değişkenleri

### 1.2 Veritabanı
- [x] PostgreSQL migration/schema dosyaları (init.sql)
- [x] Users, Customers, Calls tabloları
- [x] Seed data (test kullanıcıları, örnek müşteriler)

### 1.3 Kimlik Doğrulama
- [x] JWT tabanlı auth
- [x] Login / Logout API
- [x] Protected route middleware
- [x] Frontend: Login sayfası, token saklama, axios interceptor

---

## Faz 2: Backend Entegrasyonları (2 hafta) ✓

### 2.1 Asterisk AMI
- [x] AMI client bağlantısı (Node.js)
- [x] `NewChannel`, `AgentConnect` event dinleyicileri
- [x] CallerID parsing, extension eşleştirme

### 2.2 WebSocket / Socket.io
- [x] Socket.io sunucu kurulumu
- [x] Client auth (JWT ile socket bağlantısı)
- [x] Extension-socket eşlemesi (in-memory)
- [x] `SCREEN_POP`, `STATS_UPDATE` event emit

### 2.3 Screen Pop Logic
- [x] AMI event → CallerID → DB sorgusu (customers.phone_number)
- [x] Socket ile ilgili agent’a payload gönderme
- [x] Test: Simüle edilmiş AMI event ile popup tetikleme

---

## Faz 3: Frontend – Temsilci Deneyimi (2-3 hafta) ✓

### 3.1 Softphone
- [x] SIP.js WebRTC bağlantısı (Asterisk PJSIP WebRTC gerekli, VITE_SIP_* env)
- [x] Extension kayıt (Socket.io extension:register)
- [x] Gelen arama bildirimi (ses, sekme başlığı, tarayıcı bildirimi, pulse, Snackbar)
- [x] Gelen arama UI (cevap/reddet) — SIP.js WebRTC ile
- [x] Giden arama (numara çevirme) — Click-to-Call via AMI Originate
- [x] Mute / Unmute (SIP.js session)

### 3.2 Screen Pop Modal
- [x] WebSocket `SCREEN_POP` listener
- [x] Modal bileşeni (müşteri bilgileri)
- [x] Bilinmeyen arayan formu (yeni müşteri ekleme)
- [x] Çağrı geçmişi, disposition dropdown

### 3.3 Dashboard ve Müşteri CRUD
- [x] Agent dashboard
- [x] Müşteri listesi, arama, filtreleme
- [x] Müşteri ekleme/düzenleme formları
- [x] Durum yönetimi (Ready / Paused)
- [x] Toplu dışa aktar (CSV)
- [x] Toplu içe aktar (CSV, admin)
- [x] Kampanyaya lead aktarma (seçili müşteriler → kampanya, admin/supervisor)

---

## Faz 4: Wallboard ve Raporlama (1-2 hafta) ✓

### 4.1 Wallboard
- [x] Realtime stats API
- [x] WebSocket ile canlı güncelleme (STATS_UPDATE)
- [x] Wallboard sayfası (ajan durumları, kuyruk bekleme)
- [x] Public / TV modu (token ile /wallboard/public)

### 4.2 CDR Raporları
- [x] CDR listeleme API (filtreler ile)
- [x] Raporlar sayfası (CSV indirme)
- [x] Ses kaydı playback endpoint ve UI

---

## Faz 5: IVR ve Kuyruk (2 hafta) ✓

### 5.1 Asterisk Konfigürasyonu
- [x] Queue tanımları (queues.conf)
- [x] Dahili dialplan (extensions.conf)
- [x] Basit IVR (ivr-main context: 1=Destek, 2=Satış)

### 5.2 Kuyruk Yönetimi UI
- [x] Kuyruk CRUD API
- [x] Admin kuyruk sayfası
- [x] Ajan-kuyruk ataması

---

## Faz 6: Yönetim ve İyileştirmeler (1-2 hafta) ✓

### 6.1 Admin Panel
- [x] Kullanıcı CRUD
- [x] Extension atama
- [x] Rol yönetimi
- [x] Sistem ayarları sayfası
- [x] Asterisk AMI ayarları (Host, Port, User, Secret) panelden yapılandırma

### 6.2 Güvenlik ve Performans
- [x] Rate limiting
- [x] Input validation — **Zod** ile ana API route'larında Request Body Validation
- [x] HTTPS / WSS production hazırlığı (nginx, docker-compose.prod)
- [x] Logging ve hata yönetimi
- [x] **TypeScript:** Kritik modüller (Auth, Billing) kademeli TS'e çevrilmeli — Auth: `middleware/auth` ve `routes/auth` tamamen TS; gereksiz `auth.js` kaldırıldı. Billing modülü projede yok (ileride eklenebilir).
- [x] **TypeScript (tam geçiş):** Tüm backend kaynakları .ts: config (db, redis), utils (logger), services (ami, dialer, settings), middleware (validate), socket, routes (auth, calls, users, customers, settings, stats, test, asterisk, campaigns, chat, skills, queues, scripts), jobs (transcription), workers (transcriptionWorker). `index.js` kaldırıldı; worker script'i `tsx src/workers/transcriptionWorker.ts` olarak güncellendi.

---

## Faz 7: Test ve Yayın (1 hafta) ✓

- [x] E2E test senaryoları (Playwright: login, giriş)
- [x] Docker production build (multi-stage, npm ci)
- [x] README güncelleme
- [x] v1.0 release (CHANGELOG, PRODUCTION_DEPLOYMENT, npm run migrate)

---

## Faz 8+: Kurumsal Özellikler

Detaylı teknik açıklamalar için [ENTERPRISE_FEATURES.md](ENTERPRISE_FEATURES.md) belgesine bakın.

### Faz 8: Supervisor God Mode (2 hafta) ✓
- [x] ChanSpy entegrasyonu (Spy, Whisper, Barge)
- [x] `GET /calls/active`, `POST /calls/:id/spy`, `/whisper`, `/barge` API
- [x] Aktif çağrı listesi + müdahale butonları UI (Aktif Çağrılar sayfası)

### Faz 9: AI Transkripsiyon (2 hafta) ✓
- [x] OpenAI Whisper API entegrasyonu
- [x] BullMQ background job (Hangup → transkript, `npm run worker`)
- [x] Calls tablosu: transcript (sentiment_score, ai_summary mevcut, ileride doldurulabilir)
- [x] CDR raporlarında transkript görünümü + manuel "Transkript Al" butonu

### Faz 10: Predictive Dialer (3 hafta) ✓
- [x] Campaigns, Campaign_Leads tabloları
- [x] Power Dialer: Backend setInterval (20s) ile otomatik arama, kampanya type=power, status=active
- [x] AMI Originate (Click-to-Call)
- [x] Kampanya yönetimi UI (Preview Dialer + Power kampanya başlat/duraklat, kuyruk atama)

### Faz 11: Omnichannel (3 hafta) ✓
- [x] Interactions + chat_sessions tabloları (migration 003)
- [x] Web Chat widget — `/chat/widget` (ziyaretçi sohbet başlatır, mesaj gönderir)
- [x] Unified Inbox — Sohbet sayfası (ajan listeler, üstlenir, yanıtlar)
- [x] Müşteri detayında birleşik etkileşim timeline (çağrı + not + chat)

### Faz 12: Skill-Based Routing (2 hafta) ✓
- [x] Agent_Skills tablosu (mevcut)
- [x] GET /skills/route?skill=xxx — yeteneğe göre hazır ajan extension
- [x] Agent yetenek CRUD (Kullanıcılar → Yıldız ikonu)
- [x] Asterisk dialplan/curl entegrasyon dokümantasyonu (SKILL_ROUTING.md)

### Faz 13: CRM Entegrasyonu (1-2 hafta)
- [x] `POST /calls/initiate` (Click-to-Call)
- [x] Calls tablosu: external_id, external_type, callback_url
- [x] Webhook servisi (Hangup → CRM POST, CRM_WEBHOOK_URL)
- [x] Admin: CRM webhook URL/secret yapılandırma (Settings sayfasından)
- [x] Screen Pop'da callback_url ile CRM sayfası açma ("CRM'de Aç" butonu)

Detay: [CRM_INTEGRATION.md](CRM_INTEGRATION.md)

### Tahsilat (Collection) Modu
- [x] Scriptler CRUD, varsayılan script
- [x] Screen Pop'da borçlu müşteri için script gösterimi (placeholder: {{first_name}}, {{debt_amount}} vb.)
- [x] Preview Dialer: next-lead API, kampanya yönetimi, borçlu ekleme

---

## Özet Zaman Çizelgesi

| Faz | Süre | Çıktı |
|-----|------|-------|
| Faz 1 | 2-3 hafta | Çalışan login, DB, Docker |
| Faz 2 | 2 hafta | AMI + WebSocket + Screen Pop backend |
| Faz 3 | 2-3 hafta | Softphone + Screen Pop UI + Müşteri CRUD |
| Faz 4 | 1-2 hafta | Wallboard + CDR raporları |
| Faz 5 | 2 hafta | Kuyruk yönetimi |
| Faz 6 | 1-2 hafta | Admin panel |
| Faz 7 | 1 hafta | Test ve v1.0 |
| **Faz 8+** | **14+ hafta** | **Enterprise özellikleri** |

**MVP (Faz 1–7) tahmini:** 11-15 hafta (tek geliştirici)  
**Enterprise (Faz 8–13) tahmini:** 14+ hafta

---

## Bağımlılık Notları

1. **Faz 3** için **Faz 2** tamamlanmış olmalı (Screen Pop backend hazır).
2. **Softphone** için Asterisk’in WebRTC/PJSIP ayarları yapılmış olmalı (SETUP_GUIDE, [WEBRTC_SOFTPHONE](WEBRTC_SOFTPHONE.md)).
3. **Wallboard** için WebSocket ve AMI event’leri Faz 2’de hazır.
