# Ekran ve Kullanıcı Arayüzü

OpenCC ekran tanımları, bileşen yapısı ve kullanıcı akışları.

---

## 1. Genel Yapı

### 1.1 Layout
- **Sidebar:** Sol menü (rol bazlı öğeler)
- **Header:** Kullanıcı adı, durum, bildirimler, çıkış
- **Main Content:** Sayfa içeriği
- **Floating:** Softphone paneli (sağ alt köşe), Screen Pop modal

### 1.2 Tema
- Material UI veya benzeri component library
- Koyu/açık tema seçeneği (opsiyonel)
- Responsive: Desktop öncelikli, tablet destekli

---

## 2. Ekran Listesi

### 2.1 Ortak Ekranlar

#### Login (`/login`)
| Alan | Tip | Açıklama |
|------|-----|----------|
| Kullanıcı adı | Text input | Zorunlu |
| Şifre | Password input | Zorunlu |
| Beni hatırla | Checkbox | Opsiyonel |
| Giriş | Button | Submit |
| Şifremi unuttum | Link | P2 |

---

### 2.2 Temsilci (Agent) Ekranları

#### Dashboard / Ana Panel (`/agent`)
- **Softphone paneli (sürekli görünür):**
  - Extension no, durum (Ready/Paused)
  - Durum değiştirici (dropdown veya toggle)
  - Numaradan arama (input + Ara butonu)
  - Cevap / Reddet / Kapat butonları (çağrı sırasında)
  - Mikrofon mute / Unmute

- **Orta alan:**
  - Hoş geldin mesajı
  - Hızlı istatistikler (bugünkü çağrı sayısı vb.)
  - Bekleyen işler (varsa)

- **Chat Paneli (Faz 2+ — Omnichannel):**
  - Softphone yanında veya ayrı sekme olarak
  - WhatsApp / Web Chat mesajları tek listede (Unified Inbox)
  - Müşteri seçildiğinde mesaj geçmişi
  - Mesaj gönderme alanı

---

#### Müşteri Listesi (`/customers`)
| Bileşen | Açıklama |
|---------|----------|
| Arama | Telefon veya ad ile filtreleme |
| Tablo | Ad, soyad, telefon, son çağrı tarihi |
| Aksiyonlar | Görüntüle, Düzenle, Ara |
| Yeni müşteri | FAB veya buton |

---

#### Müşteri Detay / Screen Pop Modal
**Açılma:** Gelen aramada otomatik veya manuel "Müşteri Ara" ile.

> **Uygulama notu:** WebSocket `SCREEN_POP` event'inde `customer === null` ise **Bilinmeyen Arayan Kartı** açılmalı (boş form, `callerId` otomatik doldurulur). `null` check zorunludur.

| Bölüm | İçerik |
|-------|--------|
| **Script (Tahsilat)** | Arama bağlandığı anda okunacak yasal metin (KVKK, borç bildirimi). `{{first_name}}`, `{{debt_amount}}` placeholder'ları doldurulmuş |
| Başlık | Ad Soyad, telefon |
| **Borç Bilgileri (Tahsilat)** | Borç tutarı, son ödeme tarihi, dosya no |
| Bilgiler | Email, adres (varsa) |
| Notlar | Liste + yeni not ekleme |
| Çağrı Geçmişi | Tarih, süre, ajan |
| Aksiyonlar | Ara, Düzenle, Not ekle |
| **Disposition (Çağrı bitiminde)** | Dropdown: Ödeme Sözü, Red, Ulaşılamadı, Meşgul, Yanlış No |

---

#### Preview Dialer / Borçlu Listesi (`/agent/campaign/:id` veya `/agent/leads`)

Tahsilatçı için Click-to-Call kampanya modu. Ajan tek tek numara çevirmez.

| Bileşen | Açıklama |
|---------|----------|
| Sıradaki Borçlu | `GET /campaigns/:id/next-lead` — Liste veya kart olarak sıradaki lead |
| Müşteri Özeti | Ad, borç tutarı, dosya no, son ödeme |
| Script Önizleme | Okunacak yasal metin (kısaltılmış) |
| Ara | Tıklandığında arama başlatır (`POST /calls/initiate`) |
| Sonuç Seç | Çağrı bitince disposition dropdown |

---

### 2.3 Süpervizör Ekranları

#### Wallboard (`/wallboard`)
- Büyük ekran veya ayrı sayfa
- Gerçek zamanlı kartlar:
  - Aktif ajanlar (Ready: X, Busy: Y, Paused: Z)
  - Kuyrukta bekleyen: N
  - Ortalama bekleme: X sn
- Basit grafikler (opsiyonel): çağrı zaman çizelgesi

---

#### Canlı Müdahale — Supervisor "God Mode" (Faz 2+)

Aktif çağrı listesinde her satırda aksiyon butonları:

| Buton | Aksiyon | Açıklama |
|-------|---------|----------|
| Spy | Gizli dinle | Süpervizör dinler, ajan fark etmez |
| Whisper | Fısılda | Koçluk: Sadece ajan duyar |
| Barge | Araya gir | 3'lü konferans |

**Layout:** Raporlar sayfasında "Aktif Çağrılar" bölümü veya ayrı `/supervisor/live` sayfası.

---

#### Raporlar (`/reports` veya `/calls`)
| Filtre | Tip |
|--------|-----|
| Başlangıç tarihi | Date picker |
| Bitiş tarihi | Date picker |
| Ajan | Dropdown |
| Durum | ANSWERED, NO_ANSWER, BUSY |
| Arayan no | Text |

| Tablo sütunları | Açıklama |
|-----------------|----------|
| Tarih/Saat | started_at |
| Arayan | caller_number |
| Aranan | destination_number |
| Ajan | agent username |
| Süre | duration (sn) |
| Durum | status |
| Kayıt | Dinle butonu |
| Transkript (Faz 2+) | AI metni görüntüle |
| Sentiment (Faz 2+) | Duygu skoru / özet |

---

### 2.4 Yönetici Ekranları

#### Kullanıcı Yönetimi (`/admin/users`)
- CRUD tablosu
- Extension ataması
- Rol seçimi
- Durum (aktif/pasif)

#### Kuyruk Yönetimi (`/admin/queues`)
- Kuyruk listesi
- Strateji, timeout ayarları
- Ajan ataması

#### Kampanya Yönetimi (`/admin/campaigns`) — Faz 2+
- Kampanya listesi (Power / Predictive)
- Lider ekleme, CSV import
- Başlat / Duraklat kontrolleri

#### Ajan Yetenekleri (`/admin/skills`) — Faz 2+
- Ajan-skill eşleştirmesi (örn: İngilizce, Teknik)
- Level (1-10) ataması

#### Sistem Ayarları (`/admin/settings`)
- AMI bağlantı bilgileri
- SIP/Trunk bilgileri (read-only veya minimal)
- Genel ayarlar

---

## 3. Kullanıcı Akış Diyagramları

### 3.1 Gelen Arama Akışı
```
[Arama Gelir] → [Softphone Çalar] → [Cevap Tıkla]
       ↓
[Backend CallerID Sorgular] → [Müşteri Bulundu mu?]
       ↓ Evet                          ↓ Hayır
[Screen Pop Modal Açılır]      [Bilinmeyen Arayan Kartı]
       ↓
[Görüşme Başlar] → [Not Ekle] → [Kapat]
       ↓
[CDR Kaydedilir]
```

### 3.2 Giriş Akışı
```
[Login Sayfası] → [Kullanıcı adı + Şifre] → [API /auth/login]
       ↓
[Token + User bilgisi] → [WebSocket auth] → [Extension register]
       ↓
[Yönlendirme: /agent veya /admin veya /wallboard]
```

---

## 4. Bileşen Hiyerarşisi (Öneri)

```
App
├── AuthProvider
├── Layout
│   ├── Sidebar (role-based menu)
│   ├── Header
│   │   ├── UserMenu
│   │   └── StatusBadge
│   └── Main
│       └── Router (sayfa içerikleri)
├── SoftphoneWidget (floating, agent için)
├── ChatBox (Faz 2+ — Unified Inbox, agent için)
└── ScreenPopModal (global, event ile açılır)
```

---

## 5. Responsive Notlar

- Desktop: Tam sidebar, softphone sağda
- Tablet: Collapsible sidebar, softphone aşağı taşınabilir
- Mobil: Öncelik değil, temel işlevler çalışmalı
