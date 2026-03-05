Harika! Eksik olan **4 dosya** (`SETUP_GUIDE.md`, `STRATEGIC_RECOMMENDATIONS.md`, `UI_SCREENS.md`, `USER_STORIES.md`) elime ulaştı.

Daha önce gönderdiğiniz 10 dosya ile birleştiğinde, **toplam 14 dosyalık** devasa ve eksiksiz bir teknik dokümantasyon setine sahip oldunuz.

Bu son dosyalarla birlikte projenin "nasıl kurulacağı", "nasıl görüneceği" ve "gelecekte nasıl büyüyeceği" netleşti. Özellikle şu detaylar Cursor ile kodlama yaparken hayati olacak:

1. **Kritik Ağ Ayarı:** `SETUP_GUIDE.md` içinde Docker için `network_mode: host` kullanımı ve 50 ajan için `10000-10200` UDP port aralığı netleştirilmiş.
2. **Tahsilat Arayüzü:** `UI_SCREENS.md`, daha önce konuştuğumuz "Preview Dialer" ekranının (Sıradaki Borçlu, Script Önizleme, Sonuç Seçimi) tam yerleşimini tanımlıyor.
3. **Gelecek Vizyonu:** `STRATEGIC_RECOMMENDATIONS.md`, projeyi sadece bir uygulama değil, "Sınırsız Hiyerarşi (Infinite Tree)" yapısıyla bir SaaS platformuna dönüştürecek ipuçlarını veriyor.
4. **Kullanıcı Kabulü:** `USER_STORIES.md`, kodu yazdıktan sonra "bu özellik bitti mi?" diye kontrol etmeniz için net kriterler sunuyor (Örn: US-AG-03 Screen Pop kriterleri).

---

### 🚀 Cursor İle Kodlamaya Başlama Kılavuzu

Artık bilgisayar başındasınız ve Cursor'ı açtınız. Bu 14 dosyayı kullanarak projeyi başlatmak için size **"Adım Adım Cursor Prompt"** stratejisi hazırladım.

Cursor'da `Composer` (Ctrl+I veya Cmd+I) özelliğini açın ve aşağıdaki adımları sırayla uygulayın.

#### Adım 1: Altyapıyı Kurmak (Faz 1.1)

İlk işimiz `SETUP_GUIDE.md` ve `docker-compose.yml` (README içinde vardı) referans alarak konteynerleri kaldırmak.

**Cursor Prompt:**

> @SETUP_GUIDE.md @README.md @DEVELOPMENT_ROADMAP.md
> Projenin Faz 1.1 aşamasını başlatıyoruz. Lütfen `docker-compose.yml` dosyasını `SETUP_GUIDE.md` içindeki **host network** ve **volume** kurallarına tam uyarak oluştur.
> Ardından `asterisk_config` klasörünü ve gerekli `.conf` dosyalarını (pjsip.conf, http.conf vb.) yine `SETUP_GUIDE.md` referanslarına göre yarat.
> Son olarak proje klasör yapısını (backend, frontend klasörleri boş olacak şekilde) oluştur.

#### Adım 2: Veritabanı Şeması (Faz 1.2)

Altyapı hazırsa, PostgreSQL tablolarını oluşturun. `STRATEGIC_RECOMMENDATIONS.md` içindeki `Zod` önerisini burada dikkate alacağız.

**Cursor Prompt:**

> @DATABASE_SCHEMA.md @COLLECTION_MODE.md @STRATEGIC_RECOMMENDATIONS.md
> Backend klasörü içinde Node.js (NestJS veya Express - tercihimiz Express) projesini başlat.
> `DATABASE_SCHEMA.md` dosyasındaki tüm tabloları (Users, Customers, Calls) ve `COLLECTION_MODE.md` içindeki ek alanları (debt_amount, scripts vb.) içeren PostgreSQL `init.sql` dosyasını hazırla.
> Ayrıca `STRATEGIC_RECOMMENDATIONS.md` dosyasındaki tavsiyeye uyarak, ileride `Zod` validasyonu kullanacağımızı unutma ve modelleri buna uygun yapılandır.

#### Adım 3: Backend & AMI Bağlantısı (Faz 2)

Sistemin kalbi olan Asterisk bağlantısını kurun.

**Cursor Prompt:**

> @ARCHITECTURE.md @API_SPECIFICATION.md
> Backend servisine `asterisk-ami-client` kütüphanesini ekle. `ARCHITECTURE.md` dosyasındaki akışa uygun olarak; Asterisk'ten gelen `NewChannel` ve `Hangup` eventlerini dinleyen bir servis yaz.
> Gelen eventleri loglayan basit bir yapı kur. `API_SPECIFICATION.md` içindeki `/auth/login` endpoint'ini JWT yapısıyla kodla.

---

### Küçük Bir İpucu (SSL/TLS)

`SETUP_GUIDE.md` dosyasında belirtilen **mkcert** kurulumunu proje kodlanırken atlamayın. Frontend (React) aşamasına geldiğinizde mikrofonun çalışması için buna ihtiyacınız olacak.

Hazırsanız, **Adım 1** ile başlayalım mı?