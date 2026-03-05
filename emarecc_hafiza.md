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
- **Asterisk 20+** (PBX engine)
- **AMI (Asterisk Manager Interface)** (Node.js bridge)
- **PJSIP** (SIP channels)
- **CDR (Call Detail Records)**
- **MixMonitor** (call recording)

### Frontend
- **React 18**
- **TailwindCSS**
- **Zustand** (state management)
- **Socket.IO** (WebSocket - wallboard real-time)
- **React Hook Form** (form validation)

### DevOps
- **Docker Compose** (multi-container orchestration)
- **Nginx** (reverse proxy)
- **PM2** (process manager - optional)

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

### 1. Gelen Çağrı (Inbound)
```
Müşteri arar → Asterisk (DID: 555-1234)
  ↓
Kuyruk: cc-support
  ↓
Agent dahilileri çalar (1000, 1001, 1002, 1003)
  ↓
İlk açan ajan görüşmeyi alır
  ↓
Backend: AMI eventi yakalar (NewCallerid)
  ↓
Frontend: Screen Pop açılır (CallerID → müşteri bilgisi)
  ↓
Ajan görüşür, disposition kodu girer
  ↓
CDR kaydedilir + ses kaydı + transkripsiyon (background job)
```

### 2. Giden Çağrı (Outbound - Click-to-Call)
```
Ajan: Müşteri detay sayfasında "Ara" butonuna tıklar
  ↓
Frontend: API call → POST /api/calls/originate
  ↓
Backend: AMI Originate komutu
  ↓
Asterisk: Önce ajan dahilini arar (1001)
  ↓
Ajan açar → Asterisk müşteri numarasını arar
  ↓
Bridge (ajan ↔ müşteri)
  ↓
CDR kaydedilir
```

### 3. Preview Dialer
```
Ajan: Dashboard'ta "Sıradaki Numara" butonuna tıklar
  ↓
Backend: Kampanyadan sıradaki borçlu numarayı seç
  ↓
Screen'de müşteri bilgisi + tahsilat scripti göster
  ↓
Ajan "Ara" derse → Click-to-Call akışı
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

## 📚 Asterisk Konfigürasyon

### extensions.conf (Dial Plan)
```conf
[from-external]
exten => s,1,NoOp(Incoming call from ${CALLERID(num)})
same => n,Queue(cc-support,t,,,30)
same => n,Hangup()

[from-internal]
exten => _NXXNXXXXXX,1,NoOp(Outbound call to ${EXTEN})
same => n,Dial(PJSIP/${EXTEN}@trunk)
same => n,Hangup()
```

### queues.conf
```conf
[cc-support]
strategy = ringall
timeout = 30
retry = 5
member => PJSIP/1000
member => PJSIP/1001
member => PJSIP/1002
member => PJSIP/1003
```

## 🔄 Son Güncelleme

**Tarih:** 4 Mart 2026  
**Durum:** MVP tamamlandı, production test aşaması  
**Next Action:** Predictive dialer, multi-tenant support

---

**Vizyon:** Türkiye'nin en modern, AI destekli çağrı merkezi yazılımı. Tahsilat, müşteri hizmetleri, anket ve satış süreçleri için end-to-end çözüm.
