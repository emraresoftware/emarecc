# Cursor ile Kodlamaya Başlama Kılavuzu

Proje dokümantasyonunu kullanarak Cursor Composer ile adım adım geliştirme yapmak için bu kılavuzu takip edin.

---

## Ön Hazırlık

Bu kılavuz, aşağıdaki dokümanların hazır olduğunu varsayar:

1. **Kritik Ağ Ayarı:** `SETUP_GUIDE.md` — `network_mode: host`, UDP 10000–10200
2. **Tahsilat Arayüzü:** `UI_SCREENS.md` — Preview Dialer, Script Önizleme
3. **Stratejik Vizyon:** `STRATEGIC_RECOMMENDATIONS.md` — Infinite Tree, SaaS yol haritası
4. **Kabul Kriterleri:** `USER_STORIES.md` — "Bu özellik bitti mi?" kontrol listesi

---

---

### Adım 1: Altyapıyı Kurmak (Faz 1.1)

**Cursor Prompt:**

> @SETUP_GUIDE.md @readme.md @DEVELOPMENT_ROADMAP.md  
> Projenin Faz 1.1 aşamasını başlatıyoruz. Lütfen `docker-compose.yml` dosyasını `SETUP_GUIDE.md` içindeki **host network** ve **volume** kurallarına tam uyarak oluştur.  
> Ardından `asterisk_config` klasörünü ve gerekli `.conf` dosyalarını (pjsip.conf, http.conf vb.) `SETUP_GUIDE.md` referanslarına göre yarat.  
> Son olarak proje klasör yapısını (`backend`, `frontend` boş olacak şekilde) oluştur.

---

### Adım 2: Veritabanı Şeması (Faz 1.2)

**Not:** Backend için **Express** tercih ediyoruz (hızlı başlangıç). Faz 1'de MVP tabloları (Users, Customers, Calls) yeterli; Scripts, Campaigns vb. migration ile sonra eklenebilir.

**Cursor Prompt:**

> @DATABASE_SCHEMA.md @COLLECTION_MODE.md @STRATEGIC_RECOMMENDATIONS.md  
> Backend klasörü içinde **Express** ile Node.js projesini başlat.  
> `DATABASE_SCHEMA.md` dosyasındaki **Users, Customers, Calls** tablolarını (disposition_code, debt_amount, last_payment_date, file_number dahil) içeren PostgreSQL `init.sql` hazırla.  
> Scripts, Campaigns, Campaign_Leads tablolarını ayrı bir migration dosyasında tanımla (Faz 2+ için).  
> `STRATEGIC_RECOMMENDATIONS.md` tavsiyesine uyarak modelleri ileride **Zod** validasyonu kullanacak şekilde yapılandır.

---

### Adım 3: Backend & AMI Bağlantısı (Faz 2)

**Cursor Prompt:**

> @ARCHITECTURE.md @API_SPECIFICATION.md  
> Backend servisine `asterisk-ami-client` kütüphanesini ekle. `ARCHITECTURE.md` akışına uygun olarak Asterisk'ten gelen `NewChannel` ve `Hangup` eventlerini dinleyen bir servis yaz.  
> Gelen eventleri loglayan basit yapı kur. `API_SPECIFICATION.md` içindeki `/auth/login` endpoint'ini JWT ile kodla.

---

### Adım 4: Frontend & Softphone (Faz 3)

**Cursor Prompt:**

> @UI_SCREENS.md @API_SPECIFICATION.md @SETUP_GUIDE.md  
> Frontend klasöründe **React + Vite + Material UI** projesi oluştur.  
> `UI_SCREENS.md` layout'una uygun Login sayfası ve Layout (Sidebar, Header) hazırla.  
> Softphone bileşeni için SIP.js kurulumu yap; `SETUP_GUIDE.md`'deki WebRTC/mkcert notunu unutma — mikrofon için HTTPS gerekli.  
> Screen Pop Modal bileşenini (WebSocket `SCREEN_POP` event dinleyecek) placeholder olarak ekle.

---

## SSL/TLS Hatırlatması

`SETUP_GUIDE.md`'de belirtilen **mkcert** kurulumunu atlamayın. Frontend aşamasında mikrofon erişimi için HTTPS şarttır (localhost hariç).

```bash
brew install mkcert
mkcert -install
mkcert localhost 127.0.0.1
```

---

## Başlangıç

Hazırsanız **Adım 1** ile başlayın.
