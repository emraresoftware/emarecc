# Kurumsal (Enterprise) Özellikler

MVP tamamlandıktan sonra **Faz 2+** olarak geliştirilecek ileri düzey yetenekler. Mevcut mimari (Asterisk + Node.js + React) bu özellikleri destekleyecek şekilde tasarlanmıştır.

---

## 1. Supervisor "God Mode" (Koçluk ve Denetim)

Süpervizörün sadece raporlama ve kayıt dinleme değil, **canlı müdahale** yetenekleri.

### Yeni Yetenekler

| Özellik | Açıklama |
|---------|----------|
| **Spy (Gizli Dinleme)** | Ajan fark etmeden görüşmeyi dinler. |
| **Whisper (Fısıldama/Koçluk)** | Süpervizör konuşur, sadece ajan duyar. Müşteri duymaz. Örn: "Müşteriye şu kampanyadan bahset." |
| **Barge-in (Araya Girme)** | Süpervizör konuşmaya dahil olur, 3'lü konferans başlar. |

### Teknik Uygulama

- **Asterisk:** `ChanSpy` uygulaması kullanılır.
- **Mod Parametreleri:**
  - `ChanSpy(SIP/Agent-101)` — Sadece dinle (Spy)
  - `ChanSpy(SIP/Agent-101, w)` — Whisper modu (`w`)
  - `ChanSpy(SIP/Agent-101, b)` — Barge-in modu (`b`)
- **Backend Akışı:**
  1. Süpervizör `/calls/:id/spy` veya `/calls/:id/whisper` veya `/calls/:id/barge` endpoint'ini tetikler.
  2. Node.js AMI üzerinden `Originate` komutu ile süpervizörün softphone'u aranır.
  3. Cevap verdiğinde dialplan `ChanSpy(SIP/{agent_channel}, w|b)` çalıştırılır.
- **Yetkilendirme:** Sadece `supervisor` ve `admin` rolleri.

---

## 2. Yapay Zeka Destekli Analiz (AI & NLP)

Çağrı bitiminde sadece ses kaydı dinlemek yerine otomatik metin ve analiz.

### Yeni Yetenekler

| Özellik | Açıklama |
|---------|----------|
| **Speech-to-Text (Transkripsiyon)** | Ses kaydının otomatik metne çevrilmesi. |
| **Duygu Analizi (Sentiment Analysis)** | Müşterinin görüşme başında/sonunda sinirli/mutlu olup olmadığı. |
| **Otomatik Özetleme** | "Müşteri fatura itirazı için aradı, kayıt oluşturuldu" gibi AI özeti. |

### Teknik Uygulama

- **Workflow:**
  1. Çağrı biter (`Hangup` eventi) → Node.js `recording_path` dosyasını alır.
  2. Dosya **OpenAI Whisper** veya **Google Cloud Speech-to-Text** API’ye gönderilir.
  3. Transkript sonucu veritabanına yazılır.
- **Veritabanı:** `Calls` tablosuna `transcript` (TEXT), `sentiment_score` (FLOAT), `ai_summary` (TEXT) sütunları.
- **Async:** Transkripsiyon uzun sürebilir; background job (BullMQ) önerilir.

---

## 3. Gelişmiş Arama Kampanyaları (Predictive Dialer)

Sadece manuel giden arama yerine **otomatik arama kampanyaları**.

### Yeni Yetenekler

| Özellik | Açıklama |
|---------|----------|
| **Power Dialer** | Ajan "Hazır" olduğunda sistem sıradaki numarayı otomatik arar. |
| **Predictive Dialer** | Sistem, müsait ajan sayısından fazla arama yapar; açanları boştaki ajana bağlar. Meşgul/cevapsızları eler. |

### Teknik Uygulama

- **Redis Queue:** Aranacak listeler `Campaign_Leads` tablosundan Redis kuyruğuna atılır.
- **Worker:** Node.js worker (BullMQ) AMI üzerinden `Originate` komutu gönderir.
- **Logic:**
  - Arama açıldığında (`Answer` veya `Bridge` eventi), çağrı `Queue()` uygulamasına yönlendirilir.
  - Bekleyen ajana aktarılır.
  - Meşgul/Cevapsız: kayıt güncellenir, sonraki numara denenir.
- **Veritabanı:** `Campaigns`, `Campaign_Leads` tabloları (detay DATABASE_SCHEMA.md).

---

## 4. Omnichannel (Çok Kanallı İletişim)

Müşteri kartında sadece telefon değil, tüm etkileşimler görünmeli.

### Yeni Yetenekler

| Özellik | Açıklama |
|---------|----------|
| **WhatsApp Entegrasyonu** | WhatsApp Business API üzerinden gelen mesajlar ajan ekranında chat penceresi olarak düşer. |
| **Web Chat** | Web sitesine konulacak widget ile canlı yazışma. |

### Teknik Uygulama

- **Unified Inbox:** Frontend'de Softphone yanına `ChatBox` bileşeni.
- **Veritabanı:** `Interactions` tablosu — Type: `CALL`, `WHATSAPP`, `CHAT`. Müşteri geçmişinde kronolojik listeleme.
- **WhatsApp:** Twilio/Meta Business API webhook → Node.js → WebSocket → Agent ekranı.
- **Web Chat:** Socket.io veya benzeri real-time kanal.

---

## 5. Yetenek Bazlı Yönlendirme (Skill-Based Routing)

Standart kuyruk (Round-robin) yerine yetenek bazlı akıllı dağıtım.

### Yeni Yetenekler

| Özellik | Açıklama |
|---------|----------|
| **Skill Tagging** | Ajanlara etiket: `Agent A: [İngilizce, Teknik]`, `Agent B: [Satış]` |
| **Akıllı Dağıtım** | IVR'da "İngilizce için 9'a basın" → Çağrı sadece İngilizce yeteneği olan ve puanı en yüksek ajana düşer. |

### Teknik Uygulama

- **Veritabanı:** `agent_skills` tablosu (`agent_id`, `skill`, `level`).
- **Asterisk AGI:** Çağrı geldiğinde AGI scripti Node.js'e sorgu: "Bu çağrı kime gitmeli?"
- **Node.js:** IVR seçimine göre (örn. `skill=ingilizce`), en uygun ajanı hesaplayıp extension döner.
- **Asterisk:** Çağrı o dahiliye yönlendirilir.

---

## Öncelik Önerisi

| Özellik | Öncelik | Gerekçe |
|---------|---------|---------|
| Predictive Dialer | Satış odaklı ekipler | Otomasyon, verimlilik |
| AI Transkripsiyon | Kalite / Compliance odaklı | Raporlama, denetim |
| Supervisor God Mode | Süpervizyon odaklı | Koçluk, kalite kontrol |
| Omnichannel | Müşteri deneyimi | WhatsApp, chat talebi |
| Skill-Based Routing | Karmaşık IVR | VIP, dil, uzmanlık |

**Öneri:** Proje hedefinize göre (Satış vs. Destek vs. Karışık) yukarıdaki sırayı değiştirin.

---

## 6. CRM Entegrasyonu (Harici Sistemler)

Evrensel CRM vb. harici CRM sistemleriyle entegrasyon.

### Yeni Yetenekler

| Özellik | Açıklama |
|---------|----------|
| **Click-to-Call** | CRM müşteri kartında "Ara" → OpenCC üzerinden arama başlatma |
| **Screen Pop → CRM** | Arama geldiğinde CRM'de otomatik Lead/Contact sayfası açılması |
| **Ses Kayıtları → Timeline** | Kayıt + transkript + duygu analizi CRM Lead Timeline'a webhook ile gönderilir |

### Teknik Uygulama

- **API:** `POST /calls/initiate` (Click-to-Call)
- **Webhook:** Çağrı bitiminde CRM'e `CALL_COMPLETED` event POST
- **Query:** `GET /calls?external_id=...&external_type=lead` ile CRM tarafı kendi verisini çekebilir

**Detaylı sözleşme:** [CRM_INTEGRATION.md](CRM_INTEGRATION.md)
