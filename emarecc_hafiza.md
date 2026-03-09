# ☎️ Emare CC — OpenCC Çağrı Merkezi Sistemi

> 🔗 **Ortak Hafıza:** [`EMARE_ORTAK_HAFIZA.md`](/Users/emre/Desktop/Emare/EMARE_ORTAK_HAFIZA.md) — Tüm Emare ekosistemi, sunucu bilgileri, standartlar ve proje envanteri için bak.

## 📋 Proje Kimliği

- **Proje Adı:** Emare CC (OpenCC)
- **Kategori:** SaaS Platform / Call Center
- **Durum:** 🔵 Development
- **Kod Deposu:** `/Users/emre/Desktop/Emare/emarecc`
- **İkon:** ☎️
- **Renk Kodu:** `#22c55e`

## 🎯 Amaç ve Vizyon

**Docker üzerinde çalışan, Asterisk tabanlı, modern çağrı merkezi yazılımı — tahsilat, müşteri yönetimi, screen pop, wallboard.**

### Temel Özellikler

✅ **Auth:** JWT giriş, rol tabanlı erişim (admin, supervisor, agent)  
✅ **Müşteri Yönetimi:** CRUD, notlar, çağrı geçmişi, borç alanları  
✅ **Screen Pop:** Gelen aramada CallerID ile müşteri eşleme  
✅ **Tahsilat Script:** Müşteri borçlu ise yasal metin gösterimi  
✅ **Click-to-Call:** Softphone + müşteri detaydan AMI Originate ile arama  
✅ **Preview Dialer:** Kampanya bazlı borçlu listesi, sıradaki numarayı ara  
✅ **Wallboard:** Gerçek zamanlı ajan durumları (WebSocket)  
✅ **CDR Raporları:** Ses kaydı dinleme, AI transkripsiyon (OpenAI Whisper)  
✅ **Admin Panel:** Kullanıcılar, kuyruklar, kampanyalar, scriptler

## 🏗️ Teknoloji Stack

### Backend
- **Node.js + Express.js**
- **PostgreSQL** (müşteri, kullanıcı, kampanya verileri)
- **Redis** (session, cache, WebSocket pub/sub)
- **Bull Queue** (background jobs - transkripsiyon, email)

### VoIP
- **Asterisk 22.8.2** (PBX engine, Docker: `andrius/asterisk:latest`)
- **AMI (Asterisk Manager Interface)** (Node.js `asterisk-manager` + auto-reconnect)
- **PJSIP** (SIP channels, WebRTC endpoints)
- **SIP.js 0.21.1** (`Web.SimpleUser` — WebRTC softphone)
- **CDR (Call Detail Records)**
- **MixMonitor** (call recording)
- **GoIP16 FCT Gateway** (GSM ↔ SIP trunk)

### Frontend
- **React 18** + **Vite**
- **Material UI (MUI)** (component library)
- **SIP.js** (`Web.SimpleUser` — WebRTC SIP client)
- **React Context** (AuthContext, SipContext, SocketContext)
- **Socket.IO** (WebSocket - wallboard real-time)

### DevOps
- **Docker Compose** (multi-container orchestration)
- **Nginx** (reverse proxy, SSL termination, WSS proxy)
- **TZ=Europe/Istanbul** (tüm container'larda timezone)

### Proje Yapısı
```
emarecc/
├── docker-compose.yml          # Tüm servisler
├── start.sh                    # Tek komutla başlat
├── backend/
│   ├── server.js               # Express app
│   ├── routes/
│   │   ├── auth.js
│   │   ├── customers.js
│   │   ├── calls.js            # AMI Originate
│   │   ├── campaigns.js
│   │   └── cdr.js
│   ├── services/
│   │   ├── ami.js              # Asterisk Manager Interface
│   │   ├── transcribe.js       # OpenAI Whisper
│   │   └── wallboard.js        # Socket.IO
│   ├── jobs/
│   │   └── transcription.js    # Bull queue worker
│   └── db/
│       ├── migrations/
│       └── seeds/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── Wallboard.jsx
│   │   │   └── Reports.jsx
│   │   ├── components/
│   │   │   ├── ScreenPop.jsx   # Gelen arama pop-up
│   │   │   ├── Softphone.jsx
│   │   │   └── DispositionModal.jsx
│   │   └── hooks/
│   │       ├── useAMI.js
│   │       └── useSocket.js
│   └── dist/                   # Build output
├── asterisk_config/
│   ├── extensions.conf         # Dial plan
│   ├── pjsip.conf              # SIP endpoints
│   ├── queues.conf             # Call queues
│   └── ami.conf                # AMI users
├── recordings/                 # Call kayıtları
└── docs/
    ├── API.md
    └── DEPLOYMENT.md
```

## 🚀 Kurulum ve Çalıştırma

### Hızlı Başlangıç
```bash
cd /Users/emre/Desktop/Emare/emarecc

# Tek komutla çalıştır (db, redis, asterisk, backend, worker, frontend)
./start.sh

# Manuel başlatma
docker compose up -d

# İlk kurulumda seed (admin/admin123, agent1/admin123)
docker compose exec backend npm run seed

# Migration (database schema update)
docker compose exec backend npm run migrate
```

### Erişim URL'leri
- **Frontend:** http://localhost:3080
- **Backend API:** http://localhost:5001
- **Asterisk AMI:** localhost:5038

### Giriş Bilgileri

| Kullanıcı | Şifre | Rol | Dahili |
|-----------|-------|-----|--------|
| admin | admin123 | admin | 1000 |
| agent1 | admin123 | agent | 1001 |

## 📞 Çağrı Akışı

### 1. Gelen Çağrı (Inbound) — GSM → WebRTC
```
GSM araması → GoIP16 (Line 1, Vodafone TR)
  ↓
GoIP16 SIP INVITE → Asterisk (fct-trunk, from-pstn context)
  ↓
Dialplan: Ringing() → 180 Ringing GoIP16'ya gönderilir
  ↓
Queue(cc-support,t,,,60) → PJSIP/1000 çağrılır
  ↓
Asterisk → WebSocket üzerinden INVITE → SIP.js (browser)
  ↓
SipContext.jsx: onCallReceived → session.progress(180)
  ↓
SipIncomingModal açılır (ringtone + CallerID + Cevapla/Reddet)
  ↓
Agent "Cevapla" → session.accept() → RTP/SRTP akışı başlar
  ↓
Backend: AMI eventi ile call DB kaydı oluşturulur
  ↓
CDR kaydedilir + ses kaydı (MixMonitor)
```

### 2. Giden Çağrı (Outbound — WebRTC Direct)
```
Agent: Softphone'da numara girer veya müşteri detaydan "Ara" tıklar
  ↓
SipContext.jsx: call(numara) → SIP.js INVITE gönderir
  ↓
Browser → WebSocket → Asterisk (PJSIP/1000)
  ↓
Asterisk dialplan [from-internal]: _9. pattern match
  ↓
Dial(PJSIP/${DST}@fct-trunk,30) → GoIP16 → GSM
  ↓
GSM hattı çalar → Karşı taraf açar → Bridge
  ↓
CDR kaydedilir + ses kaydı
```
⚠️ **Not:** Outbound artık AMI Originate DEĞİL, WebRTC Direct SIP INVITE kullanıyor. Browser doğrudan Asterisk'e SIP INVITE gönderiyor.

### 3. Preview Dialer
```
Ajan: Dashboard'ta "Sıradaki Numara" butonuna tıklar
  ↓
Backend: Kampanyadan sıradaki borçlu numarayı seç
  ↓
Screen'de müşteri bilgisi + tahsilat scripti göster
  ↓
Ajan "Ara" derse → WebRTC Direct akışı (Outbound #2)
  ↓
Disposition: Arandı/Ulaşılamadı/Ödeme Sözü/vb.
```

## 🎨 Ekranlar ve Özellikler

### Dashboard (Ana Sayfa)
- **İstatistikler:** Bugün toplam arama, cevaplanan, kaçan, ortalama süre
- **Wallboard Widget:** Anlık ajan durumları (Available, Busy, Ringing, ACW)
- **Son Aramalar:** Pagination ile CDR listesi
- **Test Screen Pop:** Asterisk olmadan simülasyon butonu

### Müşteri Yönetimi
- **Listeleme:** Filtreleme (ad, telefon, borç durumu), pagination
- **Detay:** Müşteri bilgileri, borç bilgisi, çağrı geçmişi, notlar
- **CRUD:** Oluştur, Güncelle, Sil (soft delete)
- **Ara Butonu:** Click-to-call

### Wallboard (Real-time)
- **Agent Kart:** Ad, durumu, son aktivite
- **Renkler:** Yeşil (Available), Kırmızı (Busy), Sarı (Ringing), Gri (Offline)
- **WebSocket:** Socket.IO ile real-time güncelleme
- **Auto Refresh:** Her 5 saniyede bir backend'den durum çeker

### CDR Raporları
- **Filtreleme:** Tarih aralığı, ajan, yön (inbound/outbound), disposition
- **CSV İndirme**
- **Ses Kaydı:** Dinle butonu (recordings/ klasöründen)
- **Transkripsiyon:** AI ile konuşma metni (OpenAI Whisper)

### Admin Panel
- **Kullanıcılar:** CRUD, rol atama, dahili atama
- **Kuyruklar:** Kuyruk yönetimi, üye ekleme/çıkarma
- **Kampanyalar:** Borçlu listesi yükleme, preview dialer ayarları
- **Scriptler:** Tahsilat metinleri (placeholder: {{name}}, {{debt}})
- **Ayarlar:** Sistem ayarları, AMI config

## 🔌 Diğer Projelerle Entegrasyon

### → Emare Finance
- Borç bilgilerini Emare Finance'dan çek (API integration)
- Fatura kesimi → otomatik kampanya oluştur
- Ödeme alındı → disposition kodu gönder

### → Emare Asistan
- WhatsApp bildirimleri (arama özeti, transkripsiyon)
- AI summary: "Müşteri X ile görüşüldü, ödeme sözü aldı" → WhatsApp
- Unified communication (WhatsApp + telefon)

### → Emare AI
- OpenAI Whisper yerine Emare AI ile transkripsiyon
- Sentiment analysis (müşteri memnuniyeti)
- Agent coaching (konuşma kalitesi analizi)

### → Emare Log
- ISS şirketleri için tahsilat çağrı merkezi
- MikroTik logları ile entegre (unpaid subs → call list)

## 🎯 Roadmap

### Phase 1: MVP (Q1 2026) ✅
- [x] Asterisk + Docker setup
- [x] Inbound call flow
- [x] Screen pop
- [x] Basic CDR

### Phase 2: Dialer (Q2 2026)
- [x] Click-to-call
- [x] Preview dialer
- [x] Disposition codes
- [ ] Predictive dialer (auto-dial)

### Phase 3: AI (Q3 2026)
- [x] Transkripsiyon (OpenAI Whisper)
- [ ] Sentiment analysis
- [ ] Real-time agent assist (AI suggestions)
- [ ] Quality assurance (call scoring)

### Phase 4: Enterprise (Q4 2026)
- [ ] Multi-tenant support
- [ ] Reporting dashboard (BI)
- [ ] CRM integration (Salesforce, HubSpot)
- [ ] Mobile app (agent dashboard)

## 🔐 Güvenlik

- **JWT Authentication:** Token-based, refresh token
- **Role-based Access:** Admin > Supervisor > Agent
- **Call Recording Encryption:** AES-256
- **AMI Access Control:** IP whitelist
- **HTTPS/TLS:** Nginx reverse proxy
- **Database:** Encrypted connections, prepared statements (SQL injection koruması)

## 📚 Asterisk Konfigürasyon (Güncel — 8 Mart 2026)

### extensions.conf (Dial Plan)
```conf
[from-pstn]   ; GoIP16'dan gelen çağrılar
exten => s,1,NoOp(Gelen arama: ${CALLERID(num)})
same => n,Set(CALLERID(name)=${CALLERID(num)})
same => n,Ringing()                              ; ← GoIP16'ya 180 gönder (KRİTİK)
same => n,Queue(cc-support,t,,,60)
same => n,Hangup()

[from-internal]  ; Agent'tan giden çağrılar (WebRTC Direct)
exten => _9.,1,NoOp(Outbound call to ${EXTEN:1})
same => n,Set(DST=${EXTEN:1})
same => n,Dial(PJSIP/${DST}@fct-trunk,30)
same => n,Hangup()
```

### pjsip.conf — Transport (KRİTİK Ayarlar)
```ini
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
cert_file=/etc/asterisk/keys/asterisk.crt
priv_key_file=/etc/asterisk/keys/asterisk.key
external_media_address=192.168.1.64      ; ← Host IP (KRİTİK)
external_signaling_address=192.168.1.64  ; ← Host IP (KRİTİK)
local_net=172.19.0.0/16
local_net=127.0.0.0/8

[transport-ws]
type=transport
protocol=ws
bind=0.0.0.0:8088
external_media_address=192.168.1.64
external_signaling_address=192.168.1.64
local_net=172.19.0.0/16
local_net=127.0.0.0/8
```

### pjsip.conf — WebRTC Endpoint
```ini
[1000]
type=endpoint
context=from-internal
aors=1000
auth=auth-1000
webrtc=yes
dtls_auto_generate_cert=yes
ice_support=yes
media_encryption=dtls
qualify_frequency=0              ; ← OPTIONS ping KAPALI (SIP.js uyumsuzluğu)
```

### queues.conf
```conf
[cc-support]
strategy = ringall
timeout = 30
retry = 5
member => PJSIP/1000
```

### manager.conf
```conf
[admin]
secret = admin         ; ← docker-compose.yml AMI_SECRET ile eşleşmeli
read = all
write = all
```

## � FCT Gateway (GoIP16)

### Donanım
- **Cihaz:** GoIP16 (16-port GSM Gateway)
- **Firmware:** GST-1.01-68, Module: G610_V0C.58.0D_T1B
- **Yerel IP:** 192.168.1.100 (Web panel: admin/admin)
- **SN:** GOIP16E1BTR13083591
- **Mod:** Trunk Gateway Mode

### SIM Durumu
- **Sadece Line 1'de SIM var** (Line 2-16 boş, modüller kapalı)
- **Operatör:** Vodafone TR
- **IMSI:** 286027349289894
- **ICCID:** 8990029222024133507
- **Sinyal:** ~20 (orta)

### Asterisk ↔ GoIP16 Bağlantısı
- **Trunk tipi:** PJSIP (`fct-trunk`)
- **Asterisk IP:** 192.168.1.64 (host) / 172.19.0.6 (Docker container)
- **Docker NAT IP:** 149.34.200.122 (GoIP trafiği Asterisk'e bu IP'den gelir)
- **Kayıt:** REGISTER 200 OK, Contacts Reachable (~10ms RTT)
- **Dialplan:** `[from-internal]` → `_9.` pattern → `PJSIP/${DST}@fct-trunk` (prefix yok)
- **Test:** ✅ Asterisk → GoIP16 → GSM çalışıyor (7 Mart 2026 doğrulandı)

### Çözülen Sorunlar (5-7 Mart 2026)
1. GoIP16'da sip_registrar 78.47.33.186 (eski sunucu) → 192.168.1.64 yapıldı
2. AOR ismi uyumsuzluğu (`fct-aor` vs `fct-trunk`) → `fct-trunk` olarak düzeltildi
3. Docker NAT sorunu → `external_signaling/media_address=192.168.1.64` eklendi
4. identify match → `149.34.200.122` eklendi
5. Dialplan `G3687P07` prefix → kaldırıldı (Trunk GW Mode prefix istemez)
6. sip_relay_server eski IP → temizlendi

### Çözülen Sorunlar (8 Mart 2026)
7. Hangup butonu stale closure → `stateRef` pattern ile çözüldü
8. Hangup fix sonrası çağrı regresyonu → `isConnected()` + `qualify_frequency=0`
9. Rate limit 429 → `max:3000`, `/debug/*` muaf
10. AMI auto-reconnect → exponential backoff (2s→30s max)
11. **⚠️ Docker container ID SIP.js parse hatası** → `hostname: asterisk.local` (DETAY: docs/SORUNLAR.md #14)
12. Nginx cache → `no-cache` header for index.html
13. Ringing() → extensions.conf'ta Queue() öncesine eklendi
14. **Tek yönlü ses** → `rtp.conf` oluşturuldu (10000-10050), Docker port mapping eşleştirildi ✅ (9 Mart 2026 doğrulandı)

## ⚠️ KRİTİK KURALLAR — ASLA BOZMA

Bu kurallar ihlal edilirse sistem sessizce çöker ve hata bulmak saatler/günler alır:

| # | Kural | Dosya | Ne Olur Bozulursa |
|---|-------|-------|-------------------|
| 1 | `hostname: asterisk.local` | docker-compose.yml | SIP.js TÜM gelen çağrıları sessizce reddeder (hata mesajı YOK) |
| 2 | `external_media/signaling_address` | pjsip.conf | WebRTC medya akışı kopuk, tek yönlü ses |
| 3 | `Ringing()` Queue öncesi | extensions.conf | GoIP16 timeout yapar, aramalara cevap verilemez |
| 4 | `qualify_frequency=0` (1000) | pjsip.conf | SIP.js OPTIONS mesajlarını yanlış yorumlar |
| 5 | `AMI_SECRET` = manager.conf secret | docker-compose.yml | AMI bağlantısı başarısız, çağrı yönetimi çalışmaz |
| 6 | `TZ=Europe/Istanbul` | docker-compose.yml | CDR zamanları yanlış |
| 7 | `rtp.conf` port = Docker UDP mapping | rtp.conf + docker-compose.yml | Tek yönlü ses (telefon→bilgisayar ses gelmez) |

## 🔍 Docker Hostname Detayı (En Kritik Bug)

Docker container'a hostname verilmezse container ID (ör: `906da5a2be30`) hostname olarak kullanılır.
Bu ID, Asterisk SIP mesajlarının From/Contact header'larında yer alır.
RFC 3261'e göre hostname rakamla başlayamaz.
SIP.js Grammar parser bu URI'leri parse edemez → `-1` döner → mesajı sessizce düşürür.
**SONUÇ:** Hiçbir hata veya log olmadan tüm gelen çağrılar reddedilir.

**Test:**
```bash
docker compose exec asterisk hostname  # "asterisk.local" dönmeli, ASLA hex ID dönmemeli
```

## 🔄 Son Güncelleme

**Tarih:** 9 Mart 2026  
**Durum:** ✅ TÜM SES SORUNLARI ÇÖZÜLDÜ — Çift yönlü ses doğrulandı (WebRTC ↔ GSM). FCT gateway stabil, tüm kritik buglar çözüldü.  
**Çözülen Kritik Sorunlar:** Docker hostname (SIP.js parse), hangup stale closure, AMI reconnect, rate limit, Nginx cache, **tek yönlü ses (RTP port fix)**  
**Mühürlenen Ayarlar:** rtp.conf (10000-10050), docker-compose.yml (UDP 10000-10050), hostname: asterisk.local, external_media/signaling_address, Ringing(), qualify_frequency=0  
**Next Action:** Predictive dialer, multi-tenant support, AI transkripsiyon

---

**Vizyon:** Türkiye'nin en modern, AI destekli çağrı merkezi yazılımı. Tahsilat, müşteri hizmetleri, anket ve satış süreçleri için end-to-end çözüm.
