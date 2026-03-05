# OpenCC Dokümantasyon İndeksi

Projeyi planlama aşamasından kodlamaya kadar takip etmek için tüm dokümanlara buradan ulaşabilirsiniz.

---

## Planlama ve Gereksinimler

| Belge | Açıklama | Okuma Sırası |
|-------|----------|--------------|
| [REQUIREMENTS.md](REQUIREMENTS.md) | İşlevsel ve işlevsel olmayan gereksinimler. P0/P1/P2 öncelikleri | 1 |
| [USER_STORIES.md](USER_STORIES.md) | Agent, Supervisor ve Admin rollerine göre kullanıcı hikayeleri | 2 |
| [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) | Faz bazlı geliştirme planı (Faz 1–7 + Faz 8+ Enterprise) | 3 |

---

## Teknik Tasarım

| Belge | Açıklama | Okuma Sırası |
|-------|----------|--------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Sistem mimarisi, event akışı, Screen Pop süreci | 1 |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | PostgreSQL tabloları (MVP + Campaigns, Agent_Skills, Interactions) | 2 |
| [API_SPECIFICATION.md](API_SPECIFICATION.md) | REST endpoint'ler ve WebSocket event'leri | 3 |
| [UI_SCREENS.md](UI_SCREENS.md) | Ekran listesi, layout, kullanıcı akışları | 4 |

---

## Kurumsal (Enterprise) Özellikler

| Belge | Açıklama |
|-------|----------|
| [ENTERPRISE_FEATURES.md](ENTERPRISE_FEATURES.md) | Faz 2+ özellikleri: Supervisor God Mode, AI, Predictive Dialer, Omnichannel, Skill Routing |
| [CRM_INTEGRATION.md](CRM_INTEGRATION.md) | Harici CRM entegrasyonu: Click-to-Call, Screen Pop, Webhook, ses kaydı timeline |
| [COLLECTION_MODE.md](COLLECTION_MODE.md) | Tahsilat modu: Preview Dialer, Disposition, Script, Borç alanları |
| [STRATEGIC_RECOMMENDATIONS.md](STRATEGIC_RECOMMENDATIONS.md) | Stratejik vizyon, teknik borçlar, CRM entegrasyonu, yol haritası |

---

## Kurulum ve Operasyon

| Belge | Açıklama |
|-------|----------|
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Docker, Asterisk, .env yapılandırması |
| [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) | HTTPS/WSS production, nginx, SSL sertifikaları |
| [WEBRTC_STABILITY.md](WEBRTC_STABILITY.md) | "WebRTC hazır değil" için kök neden, kalıcı önlem ve canlı log runbook |
| [CURSOR_CODING_GUIDE.md](CURSOR_CODING_GUIDE.md) | Cursor Composer ile adım adım kodlama prompt'ları |

---

## Önerilen Okuma Akışı

1. **İlk kez projeyi anlamak:**  
   `readme.md` → `ARCHITECTURE.md` → `REQUIREMENTS.md`

2. **Geliştirmeye başlamadan önce:**  
   `DEVELOPMENT_ROADMAP.md` → `API_SPECIFICATION.md` → `DATABASE_SCHEMA.md` → `UI_SCREENS.md`

3. **Ortam kurulumu:**  
   `SETUP_GUIDE.md`

4. **Kodlamaya başlarken:**  
   `CURSOR_CODING_GUIDE.md`
