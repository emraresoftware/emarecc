# API Spesifikasyonu

REST API ve WebSocket event tanımları.

---

## 1. Temel Bilgiler

- **Base URL:** `http://localhost:5000/api/v1`
- **Kimlik Doğrulama:** Bearer JWT token
- **Content-Type:** `application/json`

---

## 2. Kimlik Doğrulama

### POST /auth/login
Giriş yapma.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "username": "agent1",
    "extension": "1001",
    "role": "agent",
    "status": "ready"
  }
}
```

> **⚠️ Silent Refresh:** JWT token süresi dolduğunda operatör çağrı ortasında kesilmemeli. Frontend'de Axios Interceptor ile 401 alındığında `refresh_token` ile sessiz yenileme yapılmalı.

### POST /auth/refresh
Token yenileme (Silent Refresh için).

**Request:** `{ "refresh_token": "string" }`

**Response (200):** `{ "access_token": "...", "expires_in": 3600 }`

### POST /auth/logout
Çıkış yapma. (Token invalidate edilir.)

### GET /auth/me
Mevcut kullanıcı bilgisini döner.

---

## 3. Kullanıcılar (Users)

### GET /users
Tüm kullanıcıları listeler. (Admin/Supervisor)

**Query:** `?role=agent&status=ready`

### POST /users
Yeni kullanıcı oluşturur. (Admin)

**Request:**
```json
{
  "username": "string",
  "password": "string",
  "extension": "1001",
  "role": "agent | supervisor | admin"
}
```

### PATCH /users/:id
Kullanıcı günceller.

### PATCH /users/:id/status
Durum günceller (Ready, Paused, Offline).

**Request:**
```json
{
  "status": "ready | paused | offline"
}
```

---

## 4. Müşteriler (Customers)

### GET /customers
Müşteri listesi, filtreleme ile.

**Query:** `?search=ahmet&phone=0555`

### GET /customers/:id
Tek müşteri detayı (notlar ve çağrı geçmişi dahil).

### POST /customers
Yeni müşteri ekler.

**Request:**
```json
{
  "phone_number": "+905551234567",
  "first_name": "Ahmet",
  "last_name": "Yılmaz",
  "notes": "VIP müşteri"
}
```

### PATCH /customers/:id
Müşteri günceller.

### POST /customers/:id/notes
Müşteriye not ekler.

**Request:**
```json
{
  "content": "Geri arama talep etti."
}
```

---

## 5. Çağrılar (Calls / CDR)

### GET /calls/active — Aktif Çağrılar (Supervisor)
Sadece `ringing`, `connected`, `initiating` durumundaki çağrıları listeler. ChanSpy müdahalesi için.

**Yetki:** admin, supervisor

**Response (200):** `[{ id, agent_username, agent_extension, caller_number, destination_number, direction, status, started_at, ... }]`

### GET /calls
CDR listesi.

**Query:** `?from=2025-02-01&to=2025-02-17&agent_id=uuid&status=ANSWERED&external_id=lead-123&external_type=lead`

> **CRM entegrasyonu:** `external_id` ve `external_type` ile CRM lead/contact'a ait çağrılar filtrelenebilir.

### POST /calls/initiate — CRM Entegrasyonu (Click-to-Call)

CRM müşteri kartından arama başlatma.

**Request:**
```json
{
  "phone_number": "+905551234567",
  "agent_extension": "1001",
  "external_id": "lead-12345",
  "external_type": "lead",
  "callback_url": "https://crm.example.com/lead/12345"
}
```

**Response (202):**
```json
{
  "call_id": "uuid",
  "unique_id": "1234567890.1",
  "status": "initiating"
}
```

Detay: [CRM_INTEGRATION.md](CRM_INTEGRATION.md)

### GET /calls/:id
Tek çağrı detayı (transcript, sentiment_score, ai_summary, disposition_code dahil).

### PATCH /calls/:id
Çağrı günceller (örn. çağrı bitiminde disposition_code ataması).

**Request:**
```json
{
  "disposition_code": "payment_promise | refused | unreachable | busy | wrong_number"
}
```

### GET /calls/:id/recording
Ses kaydı stream eder (audio/mpeg veya benzeri).

### POST /calls/:id/spy — Faz 2+ (Supervisor)
Süpervizör ajanı **gizli dinler**. Ajan fark etmez.  
**Yetki:** supervisor, admin

### POST /calls/:id/whisper — Faz 2+ (Supervisor)
Süpervizör **fısıldar** (koçluk). Sadece ajan duyar, müşteri duymaz.  
**Yetki:** supervisor, admin

### POST /calls/:id/barge — Faz 2+ (Supervisor)
Süpervizör **araya girer** (3'lü konferans).  
**Yetki:** supervisor, admin

---

## 5.1 Skill-Based Routing

### GET /skills/route?skill=ingilizce
IVR/AGI için: Yeteneğe göre en uygun hazır ajanın extension'ı.  
**Auth:** `?token=xxx` (SKILL_ROUTE_TOKEN env, production'da önerilir)  
**Response (200):** `{ "extension": "1001" }`  
**Response (404):** Uygun ajan yok

### GET /skills/user/:id
Ajanın yetenek listesi. **Yetki:** admin, supervisor

### POST /skills/user/:id
Yetenek ekle. **Request:** `{ "skill": "ingilizce", "level": 8 }` (level 1-10) **Yetki:** admin

### DELETE /skills/user/:id/:skillId
Yetenek kaldır. **Yetki:** admin

Detay: [SKILL_ROUTING.md](SKILL_ROUTING.md)

---

## 6. Kuyruklar (Queues)

### GET /queues
Tüm kuyrukları listeler.

### POST /queues
Yeni kuyruk oluşturur.

**Request:**
```json
{
  "name": "satis",
  "strategy": "round-robin",
  "timeout": 30,
  "ring_strategy": "ring-all"
}
```

### PATCH /queues/:id
Kuyruk günceller.

---

## 6b. Kampanyalar (Campaigns) — Faz 2+

### GET /campaigns
Kampanya listesi.

### POST /campaigns
Yeni kampanya oluşturur.

**Request:**
```json
{
  "name": "string",
  "type": "power | predictive | preview",
  "queue_id": "uuid"
}
```

### PATCH /campaigns/:id
Kampanya günceller (status: active, paused).

### POST /campaigns/:id/leads
Kampanya listesine müşteri/lider ekler.

**Request:**
```json
{
  "customer_id": "uuid",
  "phone_number": "+90..."
}
```

### GET /campaigns/:id/leads
Kampanya lider listesi.

### POST /campaigns/:id/start
Kampanyayı başlatır (worker tetiklenir).

### POST /campaigns/:id/pause
Kampanyayı duraklatır.

### GET /campaigns/:id/next-lead — Preview Dialer

Ajanın önüne sıradaki borçluyu getirir. `status='new'` olan ilk lead döner (sıra: created_at ASC).

**Response (200):**
```json
{
  "lead": {
    "id": "uuid",
    "customer": {
      "id": "uuid",
      "first_name": "Ahmet",
      "last_name": "Yılmaz",
      "phone_number": "+905551234567",
      "debt_amount": 15000,
      "last_payment_date": "2023-12-01",
      "file_number": "2024/12345"
    },
    "script": {
      "content": "Sayın {{first_name}} {{last_name}}, [Banka] borcunuzla ilgili..."
    }
  }
}
```

**Response (204):** Sırada lead yok.

---

## 6c. Scripts (Yasal Metinler) — Tahsilat

### GET /scripts
Script listesi.

### POST /scripts
Yeni script oluşturur.

**Request:**
```json
{
  "name": "Banka X Tahsilat",
  "content": "Sayın {{first_name}} {{last_name}}...",
  "is_default": false
}
```

### PATCH /scripts/:id
Script günceller.

---

## 7. Wallboard / İstatistikler

### GET /stats/realtime
Anlık istatistikler.

**Response:**
```json
{
  "agents": {
    "ready": 5,
    "busy": 3,
    "paused": 2
  },
  "queue_waiting": 4,
  "avg_wait_time": 15
}
```

---

## 8. WebSocket Events

**Bağlantı:** `ws://localhost:5000` (Socket.io)

### Client → Server

| Event | Payload | Açıklama |
|-------|---------|----------|
| `auth` | `{ token: string }` | Giriş sonrası token gönderilir |
| `extension:register` | `{ extension: string }` | Extension ile socket eşleştirilir |
| `status:update` | `{ status: string }` | Ready/Paused/Offline |

### Server → Client

| Event | Payload | Açıklama |
|-------|---------|----------|
| `CALL_INCOMING` | `{ callerId, uniqueId, customer? }` | Gelen arama |
| `CALL_ANSWERED` | `{ uniqueId, duration }` | Cevaplandı |
| `CALL_ENDED` | `{ uniqueId, status }` | Çağrı sonlandı |
| `STATUS_UPDATE` | `{ agents, queue }` | Wallboard güncellemesi |
| `SCREEN_POP` | `{ customer, callerId }` | Müşteri kartı aç (Screen Pop) |

### Screen Pop Örneği
```json
{
  "type": "SCREEN_POP",
  "payload": {
    "callerId": "+905551234567",
    "uniqueId": "1234567890.1",
    "customer": {
      "id": "uuid",
      "first_name": "Ahmet",
      "last_name": "Yılmaz",
      "phone_number": "+905551234567",
      "notes": "..."
    }
  }
}
```

> **⚠️ `customer: null` Durumu:** Veritabanında müşteri bulunamazsa `customer` alanı `null` döner. Frontend bu durumda **Bilinmeyen Arayan Kartı** açmalı — boş form ile yeni müşteri ekleme imkanı sunulmalı. `null` check yapılmaması runtime hatasına yol açar.

---

## 9. Hata Yanıtları

| HTTP Kodu | Açıklama |
|-----------|----------|
| 400 | Bad Request - Geçersiz istek |
| 401 | Unauthorized - Token geçersiz/eksik |
| 403 | Forbidden - Yetkisiz erişim |
| 404 | Not Found |
| 500 | Server Error |

**Hata formatı:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```
