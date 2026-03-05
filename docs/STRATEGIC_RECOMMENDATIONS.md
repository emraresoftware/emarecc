# Stratejik Tavsiyeler ve Yol Haritası

Evrensel CRM & OpenCC entegrasyonu ve SaaS platformu vizyonu için stratejik tavsiyeler.

---

## 1. Stratejik Vizyon (2026 ve Ötesi)

Bu özellikler "Blue Ocean" stratejileri olarak değerlendirilebilir.

### Sınırsız Hiyerarşi (Infinite Tree) Mimarisi

| Tavsiye | Fayda |
|---------|-------|
| User/Team yapısını Node bazlı (Parent-Child) recursive yapıya dönüştürün | Bayiler alt bayilerini, onlar satış temsilcilerini oluşturabilir. Her düğüm izole CRM gibi çalışır |

**Teknik:** PostgreSQL `LTREE` eklentisi veya Recursive CTE sorguları.

### Agentic AI (Otonom Ajanlar)

| Tavsiye | Fayda |
|---------|-------|
| Sadece Chatbot değil, iş yapan ajanlar | "Stok azaldığında sipariş taslağı", "Teklif süresi geçince uyarı" — Operasyonel yük %40 azalır |

### Dinamik Veri Gizliliği (Privacy Shield)

| Tavsiye | Fayda |
|---------|-------|
| Erişimi role değil, ağaçtaki konuma ve ilişki türüne göre belirleyin | GDPR/KVKK uyumluluk, ticari sırların korunması (Bayi A, Bayi B fiyatını göremez) |

---

## 2. Teknik Altyapı ve Borçlar

### Veritabanı: SQLite → PostgreSQL

| Durum | Tavsiye |
|-------|---------|
| CRM SQLite kullanıyorsa | PostgreSQL'e geçilmeli. LTREE / Recursive CTE için SQLite yetersiz |

**Not:** OpenCC zaten PostgreSQL kullanıyor (DATABASE_SCHEMA).

### Validasyon ve Güvenlik

| Durum | Tavsiye |
|-------|---------|
| API validasyonu eksik | Tüm API route'larına **Zod** ile Request Body Validation eklenmeli |

### Type Safety (TypeScript)

| Durum | Tavsiye |
|-------|---------|
| Proje JavaScript ise | Yeni modüller TypeScript ile yazılmalı. Auth, Billing gibi kritik modüller kademeli TS'e çevrilmeli |

---

## 3. Entegrasyon: OpenCC & Evrensel CRM

### Tekilleştirilmiş Kimlik (Unified Auth)

| Tespit | Tavsiye |
|--------|---------|
| OpenCC AUTH-001 ve CRM ayrı auth | **OAuth2 / OIDC** tek master. Çağrı merkezi ajanları CRM şifreleri ile softphone'a giriş yapmalı |

### Veritabanı Paylaşımı (Shared Customer DB)

| Tespit | Tavsiye |
|--------|---------|
| OpenCC Customers + CRM Lead mükerrer | OpenCC `Customers` tablosu iptal edilmeli. Sorgular doğrudan CRM PostgreSQL'deki `Lead`/`Customer` tablolarına atılmalı |

### Screen Pop Entegrasyonu

| Tavsiye |
|---------|
| Popup gereksinimi için: OpenCC backend çağrı geldiğinde CRM frontend'e WebSocket eventi gönderir; CRM içinde Floating Modal açılır |

Detay: [CRM_INTEGRATION.md](CRM_INTEGRATION.md)

---

## 4. Eksik Görülen Noktalar

| Konu | Tavsiye |
|------|---------|
| **SSL/TLS** | NF-07 gereği WebRTC için HTTPS şart. Lokal geliştirmede `mkcert` kurulmazsa ses iletimi çalışmayabilir |
| **Redis** | NF-05 için Redis'in Docker Compose'da persistent volume ile saklanması gerekir |

Detay: [SETUP_GUIDE.md](SETUP_GUIDE.md)

---

## 5. Özet Yol Haritası

| Hafta | Hedef |
|-------|-------|
| 1-2 | Altyapı: PostgreSQL geçişi (CRM) + Zod Validasyonu |
| 3-4 | OpenCC Entegrasyonu: Arama yapma, karşılama, Screen Pop |
| 5+ | SaaS Vizyonu: Sınırsız ağaç yapısı, yetki mekanizması |

Bu strateji, projeyi standart bir CRM'den kendi pazarını yaratan bir ekosisteme dönüştürecektir.
