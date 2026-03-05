# Proje Gereksinimleri

Bu belge OpenCC (Çağrı Merkezi) projesinin işlevsel ve işlevsel olmayan gereksinimlerini tanımlar.

---

## 1. İşlevsel Gereksinimler

### 1.1 Kimlik Doğrulama ve Yetkilendirme

| ID | Gereksinim | Öncelik |
|----|------------|---------|
| AUTH-001 | Kullanıcılar kullanıcı adı ve şifre ile giriş yapabilmeli | P0 |
| AUTH-002 | Role tabanlı erişim kontrolü (admin, agent, supervisor) | P0 |
| AUTH-003 | Oturum (session) yönetimi ve token tabanlı kimlik doğrulama | P0 |
| AUTH-004 | Şifre sıfırlama / unutulan şifre akışı | P2 |

### 1.2 Temsilci (Agent) İşlemleri

| ID | Gereksinim | Öncelik |
|----|------------|---------|
| AGT-001 | Temsilci girişte dahili numarasına (extension) otomatik atanmalı | P0 |
| AGT-002 | Durum yönetimi: Ready, Paused, Offline, Ringing, Busy | P0 |
| AGT-003 | WebRTC Softphone ile tarayıcıdan arama/alma | P0 |
| AGT-004 | Gelen aramayı kabul et / reddet / sesli mesaja yönlendir | P0 |
| AGT-005 | Giden arama başlatma (numara çevirme) | P0 |
| AGT-006 | Müzakere (hold), transfer, konferans | P1 |
| AGT-007 | Çağrı sırasında not ekleme | P0 |

### 1.3 Screen Pop (Müşteri Kartı)

| ID | Gereksinim | Öncelik |
|----|------------|---------|
| POP-001 | Gelen aramada CallerID ile müşteri eşleştirme | P0 |
| POP-002 | Eşleşme varsa otomatik popup ile müşteri bilgisi gösterme | P0 |
| POP-003 | Eşleşme yoksa "bilinmeyen arayan" kartı ile yeni müşteri ekleme imkanı | P0 |
| POP-004 | Popup'ta müşteri geçmişi (önceki aramalar) görüntüleme | P1 |
| POP-005 | Arama sırasında müşteri bilgisi güncelleme | P0 |

### 1.4 Müşteri Yönetimi

| ID | Gereksinim | Öncelik |
|----|------------|---------|
| CST-001 | Müşteri CRUD (oluştur, oku, güncelle, sil) | P0 |
| CST-002 | Telefon numarasına göre arama (Indexli) | P0 |
| CST-003 | Müşteri adı/telefon ile arama (filtreleme) | P0 |
| CST-004 | Müşteriye not ekleme | P0 |
| CST-005 | Müşteri-Çağrı ilişkisi (geçmiş görüntüleme) | P0 |

### 1.5 Kuyruk ve IVR

| ID | Gereksinim | Öncelik |
|----|------------|---------|
| IVR-001 | JSON/YAML tabanlı IVR konfigürasyonu | P1 |
| IVR-001b | Sürükle-bırak IVR akış editörü (React Flow vb.) | P2 |
| IVR-002 | Kuyruk (Queue) tanımlama ve strateji seçimi | P1 |
| IVR-003 | Stratejiler: Ring-all, Round-robin, Least-recent, Fewest-calls | P1 |
| IVR-004 | Bekleme müziği ve timeout ayarları | P2 |

### 1.6 Canlı İzleme (Wallboard)

| ID | Gereksinim | Öncelik |
|----|------------|---------|
| WAL-001 | Aktif ajan sayısı ve durumları | P0 |
| WAL-002 | Kuyrukta bekleyen çağrı sayısı | P0 |
| WAL-003 | Ortalama bekleme süresi | P1 |
| WAL-004 | Gerçek zamanlı güncelleme (WebSocket) | P0 |

### 1.7 Raporlama (CDR)

| ID | Gereksinim | Öncelik |
|----|------------|---------|
| RPT-001 | Çağrı detay kayıtları (CDR) listeleme | P0 |
| RPT-002 | Tarih aralığı ve filtreleme (ajan, durum) | P0 |
| RPT-003 | Toplam süre, cevaplanan/cevapsız istatistikleri | P0 |
| RPT-004 | Ses kayıtlarına erişim (playback) | P1 |
| RPT-005 | Dışa aktarma (CSV/Excel) | P2 |

### 1.8 Yönetim (Admin)

| ID | Gereksinim | Öncelik |
|----|------------|---------|
| ADM-001 | Kullanıcı (temsilci) ekleme/düzenleme/silme | P0 |
| ADM-002 | Dahili numarası (extension) atama | P0 |
| ADM-003 | Kuyruk ataması | P1 |
| ADM-004 | Sistem ayarları (AMI, SIP bilgileri) | P2 |

### 1.9 Süpervizör Gelişmiş Özellikleri (Faz 2+)

| ID | Gereksinim | Öncelik |
|----|------------|---------|
| SUP-001 | **Spy (Gizli Dinleme):** Ajan fark etmeden süpervizör görüşmeyi dinleyebilmeli | P2 |
| SUP-002 | **Whisper (Fısıldama):** Süpervizör ajana konuşabilmeli (müşteri duymaz) | P2 |
| SUP-003 | **Barge-in (Araya Girme):** Süpervizör görüşmeye dahil olabilmeli (3'lü konferans) | P2 |

### 1.10 Yapay Zeka ve Analiz (Faz 2+)

| ID | Gereksinim | Öncelik |
|----|------------|---------|
| AI-001 | **Speech-to-Text:** Çağrı sonrası ses kaydının metne dökülmesi | P3 |
| AI-002 | **Sentiment Analysis:** Müşterinin duygu durumunun (pozitif/negatif) analizi | P3 |
| AI-003 | **Auto-Summary:** Görüşme özetinin AI tarafından çıkarılması | P3 |

### 1.11 Çoklu Kanal ve Kampanya (Faz 2+)

| ID | Gereksinim | Öncelik |
|----|------------|---------|
| OMNI-001 | **WhatsApp Entegrasyonu:** Gelen mesajların ajan ekranına düşmesi | P2 |
| DIAL-001 | **Predictive Dialer:** Sistem listedeki numaraları otomatik arayıp müsaite bağlamalı | P3 |

### 1.12 Tahsilat (Collection) Modu

| ID | Gereksinim | Öncelik |
|----|------------|---------|
| COL-001 | **Preview Dialer:** Ajan önüne borçlu listesi gelmeli, "Ara" ile sırayla arama | P2 |
| COL-002 | **Disposition Codes:** Çağrı bitiminde dropdown (Ödeme Sözü, Red, Ulaşılamadı, Meşgul, Yanlış No) | P2 |
| COL-003 | **Scripting:** Arama bağlandığı anda Screen Pop'ta okunacak yasal metin (KVKK, borç bildirimi) | P2 |
| COL-004 | **Borç Alanları:** Müşteri kartında borç tutarı, son ödeme tarihi, dosya no | P2 |

---

## 2. İşlevsel Olmayan Gereksinimler

### 2.1 Performans

| ID | Gereksinim |
|----|------------|
| NF-01 | Ekran popup 500ms içinde açılmalı (event → UI) |
| NF-02 | WebSocket mesajı gecikmesi < 100ms |
| NF-03 | Sayfa yüklenme süresi < 2 saniye |

### 2.2 Ölçeklenebilirlik

| ID | Gereksinim |
|----|------------|
| NF-04 | Minimum 50 eşzamanlı temsilci desteklenmeli *(RTP: 50 ajan × 2 bacağı = 100 port — UDP 10000–10200 aralığı gerekir, bkz. SETUP_GUIDE)* |
| NF-05 | Redis ile session/cache için hazır olmalı |

### 2.3 Güvenlik

| ID | Gereksinim |
|----|------------|
| NF-06 | Şifreler hash'lenmiş (bcrypt) saklanmalı |
| NF-07 | Production'da **HTTPS** (API) ve **WSS** (WebSocket) zorunlu — Mikrofon erişimi `http://` üzerinde çalışmaz (localhost hariç) |
| NF-08 | API rate limiting uygulanmalı |

### 2.4 Teknoloji Kısıtları

| ID | Gereksinim |
|----|------------|
| NF-09 | Modern tarayıcılar (Chrome, Firefox, Edge) |
| NF-10 | WebRTC için mikrofon izni gerekir. **Chrome vb. `http://` (güvensiz) üzerinde mikrofon erişimine izin vermez** — Canlı ortamda mutlaka SSL (HTTPS + WSS) |
| NF-11 | Docker ile tek komutla deploy edilebilmeli |

---

## 3. Öncelik Açıklamaları

- **P0:** MVP için zorunlu, v1.0'da mutlaka olmalı
- **P1:** v1.0 veya v1.1'de eklenmeli
- **P2:** İleriki sürümlerde değerlendirilecek (Faz 2)
- **P3:** Enterprise fazında değerlendirilecek (Faz 3)
