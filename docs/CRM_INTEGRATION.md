# CRM Entegrasyonu

OpenCC'nin harici CRM sistemleri (Evrensel CRM vb.) ile entegrasyonu için API sözleşmesi ve mimari.

---

## 1. Vizyon

- **Click-to-Call:** CRM müşteri kartında "Ara" butonu → OpenCC üzerinden arama başlatma
- **Screen Pop → CRM:** Arama geldiğinde CRM'de otomatik Lead/Contact detay sayfası açılması
- **Ses Kayıtlarının CRM Timeline'a Akışı:** Kayıt + transkript + duygu analizi → Lead Timeline
- **Tek Entegrasyon Noktası:** CRM tarafı yalnızca OpenCC API ve Webhook kullanır

### Evrensel CRM Özel Tavsiyeler

| Konu | Tavsiye |
|------|---------|
| **Unified Auth** | OAuth2/OIDC tek master. Ajanlar CRM şifreleri ile softphone'a giriş yapmalı |
| **Shared DB** | OpenCC Customers tablosu iptal; sorgular doğrudan CRM Lead/Customer tablolarına |
| **Screen Pop** | OpenCC WebSocket → CRM frontend'de Floating Modal açılır |

---

## 2. Entegrasyon Akışları

### 2.1 Click-to-Call (CRM → OpenCC)

CRM müşteri kartında "Ara" tıklandığında:

```
[CRM: Ara butonu] → POST /api/v1/calls/initiate
       ↓
[OpenCC: Hedef ajan + numara] → AMI Originate
       ↓
[Ajan softphone çalar] → Cevap → Görüşme başlar
```

**CRM gereksinimleri:**
- Hedef ajanın extension'ı (veya kuyruk)
- Aranacak telefon numarası
- CRM `contact_id` / `lead_id` (Screen Pop callback için)

---

### 2.2 Screen Pop → CRM (OpenCC → CRM)

Arama geldiğinde CRM'de ilgili Lead sayfasının açılması:

```
[OpenCC: Gelen arama] → CallerID → Müşteri eşleşmesi
       ↓
[WebSocket: SCREEN_POP event] → CRM iframe / tab içinde URL aç
       ↓
[CRM: /lead/{id} veya /contact/{id}] → Sayfa yüklenir
```

**İki mod:**

| Mod | Açıklama | Veri Kaynağı |
|-----|----------|--------------|
| **Embed (iframe)** | OpenCC içinde CRM sayfası iframe | OpenCC `external_url` config |
| **External (yeni sekme)** | CRM kendi penceresinde URL açılıyor | WebSocket `callback_url` payload |

---

### 2.3 Ses Kayıtları ve AI → CRM Timeline

Çağrı bittiğinde kayıt ve AI çıktıları CRM'e akar:

```
[OpenCC: Hangup] → Kayıt dosyası oluşur
       ↓
[AI Job: Whisper + Sentiment] → transcript, sentiment_score, ai_summary
       ↓
[Webhook: POST {crm_webhook_url}] → CRM Timeline'a event ekler
```

**CRM Timeline event formatı:**
- Tip: `CALL_RECORDING`
- İçerik: kayıt URL'si, transkript, özet, duygu skoru
- Metadata: `call_id`, `agent_id`, `duration`, `started_at`

---

## 3. API Sözleşmesi (CRM Tarafı İçin)

### 3.1 Arama Başlatma (Click-to-Call)

#### POST /api/v1/calls/initiate

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

| Alan | Zorunlu | Açıklama |
|------|---------|----------|
| phone_number | ✅ | Aranacak numara |
| agent_extension | ✅ | Aramayı yapacak ajanın dahilisi |
| external_id | ❌ | CRM'deki lead/contact ID (Screen Pop için) |
| external_type | ❌ | `lead` \| `contact` |
| callback_url | ❌ | Screen Pop'da açılacak CRM sayfası URL'si |

**Response (202):**
```json
{
  "call_id": "uuid",
  "unique_id": "1234567890.1",
  "status": "initiating",
  "message": "Arama başlatıldı"
}
```

---

### 3.2 Webhook (OpenCC → CRM)

Çağrı bittiğinde OpenCC, CRM'e webhook POST atar.

**CRM tarafında yapılandırma:** Admin panelde `crm_webhook_url` ve `crm_webhook_secret` tanımlanır.

**Payload:**
```json
{
  "event": "CALL_COMPLETED",
  "timestamp": "2025-02-17T14:30:00Z",
  "payload": {
    "call_id": "uuid",
    "asterisk_uniqueid": "1234567890.1",
    "direction": "inbound",
    "caller_number": "+905551234567",
    "destination_number": "1001",
    "agent_id": "uuid",
    "status": "ANSWERED",
    "duration": 180,
    "recording_url": "https://opencc.example.com/api/v1/calls/{id}/recording",
    "transcript": "Müşteri fatura itirazı...",
    "sentiment_score": 0.3,
    "ai_summary": "Müşteri fatura itirazı için aradı, kayıt oluşturuldu.",
    "external_id": "lead-12345",
    "external_type": "lead",
    "started_at": "2025-02-17T14:27:00Z"
  }
}
```

**Güvenlik:** `X-Webhook-Signature` header'ında HMAC-SHA256 imza gönderilir. CRM doğrulama yapmalıdır.

---

### 3.3 CRM Tarafından Kayıt/Transkript Çekme

CRM, webhook almadan önce veya sonra kayıt/transkript çekebilir:

**GET /api/v1/calls/:id**  
Çağrı detayı (transcript, sentiment_score, ai_summary dahil).

**GET /api/v1/calls/:id/recording**  
Ses kaydı stream (veya signed URL).

**Query ile filtreleme:**
```
GET /api/v1/calls?external_id=lead-12345&external_type=lead
```
CRM `external_id` ile kendi lead/contact'ına ait çağrıları listeleyebilir.

---

## 4. Veritabanı Genişletmesi

`Calls` tablosuna CRM entegrasyonu için alanlar:

| Column | Type | Description |
|--------|------|-------------|
| external_id | VARCHAR | CRM'deki lead/contact ID |
| external_type | VARCHAR | `lead`, `contact` vb. |
| callback_url | VARCHAR | Screen Pop için CRM sayfa URL'si |

*(Mevcut şemaya eklenebilir — migration gerektirir.)*

---

## 5. Yapılandırma

### 5.1 Admin Panel (önerilen)
**Ayarlar** sayfasından (admin rolü) CRM Webhook URL ve Secret yapılandırılabilir. Panel değerleri `.env`'den önceliklidir.

### 5.2 Environment (.env) — Fallback
```bash
# CRM Webhook (OpenCC → CRM) — Panel boşsa kullanılır
CRM_WEBHOOK_URL=https://crm.example.com/api/webhooks/opencc
CRM_WEBHOOK_SECRET=shared_secret_for_hmac

# CRM Callback (Screen Pop - opsiyonel)
CRM_BASE_URL=https://crm.example.com
```

**Mevcut kurulumlar:** `backend/migrations/002_system_settings.sql` migration'ı çalıştırın.

---

## 6. Geliştirme Fazı

| Adım | İçerik | Bağımlılık |
|------|--------|------------|
| 1 | `POST /calls/initiate` endpoint | Faz 2 (AMI) |
| 2 | Calls tablosuna external_id, external_type, callback_url | Faz 1 |
| 3 | Webhook servisi (Hangup → POST CRM) | Faz 2, Faz 9 (AI) |
| 4 | Screen Pop'da callback_url ile CRM sayfası açma | Faz 3 |
| 5 | Admin: CRM webhook URL/secret yapılandırma | Faz 6 |

**Tahmini süre:** 1–2 hafta (Faz 2–3 tamamlandıktan sonra)
