# OpenCC - Modern Dockerized Call Center System

OpenCC, Docker üzerinde çalışan, Asterisk tabanlı, modern web teknolojileri (Node.js & React) ile güçlendirilmiş, "Screen Pop" (Müşteri Kartı Açma) özellikli açık kaynaklı bir çağrı merkezi yazılımıdır.

## 🚀 Özellikler

* **Tam Dockerize Yapı:** Tek komutla tüm sistemi ayağa kaldırma.
* **WebRTC Softphone:** Tarayıcı üzerinden ekstra programa gerek kalmadan görüşme.
* **Smart Screen Pop:** Arama geldiği anda müşteriyi tanıma ve popup açma.
* **Canlı İzleme (Wallboard):** Kuyruk durumu, aktif ajanlar ve bekleme süreleri.
* **IVR & Kuyruk Yönetimi:** Sürükle bırak IVR ve gelişmiş kuyruk stratejileri.
* **Raporlama:** Detaylı CDR (Call Detail Record) analizi.

## 🛠 Teknoloji Yığını

* **PBX Engine:** Asterisk 18+ (PJSIP)
* **Backend:** Node.js (NestJS/Express), Socket.io
* **Frontend:** React (Vite), Material UI, SIP.js
* **Database:** PostgreSQL (Müşteri & Loglar), Redis (Cache & Session)
* **Integration:** Asterisk Manager Interface (AMI)

## ⚡️ Hızlı Kurulum

1.  Repoyu klonlayın:
	```bash
	git clone https://github.com/user/opencc.git
	cd opencc
	```

2.  Environment dosyasını oluşturun:
	```bash
	cp .env.example .env
	```

3.  Docker konteynerlerini başlatın:
	```bash
	docker-compose up -d --build
	```

4.  Tarayıcıdan erişin:
	* Frontend: `http://localhost:3080`
	* Backend API: `http://localhost:5000`
	* Veritabanı (Adminer/PgAdmin): `http://localhost:8080`

## 📚 Dokümantasyon

Tüm dokümanlar `docs/` klasöründedir. Detaylı indeks için [docs/INDEX.md](docs/INDEX.md) sayfasına bakın.

| Belge | Açıklama |
|-------|----------|
| [INDEX.md](docs/INDEX.md) | Dokümantasyon indeksi |
| [REQUIREMENTS.md](docs/REQUIREMENTS.md) | İşlevsel ve işlevsel olmayan gereksinimler |
| [USER_STORIES.md](docs/USER_STORIES.md) | Kullanıcı hikayeleri (Agent, Supervisor, Admin) |
| [API_SPECIFICATION.md](docs/API_SPECIFICATION.md) | REST API ve WebSocket tanımları |
| [UI_SCREENS.md](docs/UI_SCREENS.md) | Ekran ve arayüz tanımları |
| [DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md) | Faz bazlı geliştirme planı |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Mimari ve iş akışı |
| [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Veritabanı şeması |
| [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) | Kurulum ve Docker ayarları |
| [ENTERPRISE_FEATURES.md](docs/ENTERPRISE_FEATURES.md) | Kurumsal özellikler (Faz 2+): God Mode, AI, Dialer, Omnichannel |
| [CRM_INTEGRATION.md](docs/CRM_INTEGRATION.md) | Harici CRM entegrasyonu (Click-to-Call, Webhook, Timeline) |
| [COLLECTION_MODE.md](docs/COLLECTION_MODE.md) | Tahsilat modu (Preview Dialer, Disposition, Script, Borç) |
| [STRATEGIC_RECOMMENDATIONS.md](docs/STRATEGIC_RECOMMENDATIONS.md) | Stratejik vizyon, teknik borçlar, yol haritası |
| [CURSOR_CODING_GUIDE.md](docs/CURSOR_CODING_GUIDE.md) | Cursor ile adım adım kodlama prompt'ları |
