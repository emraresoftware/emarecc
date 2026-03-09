# 📚 Emare CC — Dokümantasyon İndeksi

> **Son Güncelleme:** 8 Mart 2026  
> **Standart:** Root'ta max 3 MD (README, DOSYA_YAPISI, proje_hafiza). Diğer tüm dokümantasyon burada.

---

## 🏗️ Mimari & Teknik

| Dosya | Açıklama |
|-------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Sistem mimarisi (Docker, servisler, ağ topolojisi) |
| [API_SPECIFICATION.md](API_SPECIFICATION.md) | REST API endpoint tanımları |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | PostgreSQL tablo yapıları |
| [WEBRTC_SOFTPHONE.md](WEBRTC_SOFTPHONE.md) | SIP.js WebRTC softphone entegrasyonu |
| [WEBRTC_STABILITY.md](WEBRTC_STABILITY.md) | WebRTC kararlılık notları ve çözümler |
| [SKILL_ROUTING.md](SKILL_ROUTING.md) | Yetenek bazlı çağrı yönlendirme |

## 📞 FCT / GoIP16 Gateway

| Dosya | Açıklama |
|-------|----------|
| [FCT_GATEWAY.md](FCT_GATEWAY.md) | GoIP16 GSM Gateway kurulum ve konfigürasyon |
| [FCT_KONTROL_LISTESI.md](FCT_KONTROL_LISTESI.md) | FCT kontrol listesi (SIP register, port, trunk) |

## 🚀 Kurulum & Deploy

| Dosya | Açıklama |
|-------|----------|
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Detaylı kurulum rehberi |
| [QUICKSTART_DEV.md](QUICKSTART_DEV.md) | Hızlı başlangıç (geliştirici) |
| [KURULUM_REHBERI.md](KURULUM_REHBERI.md) | Kurulum rehberi (Türkçe) |
| [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) | Production ortamı deploy |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Gereksinimler ve bağımlılıklar |

## 📋 İş Gereksinimleri

| Dosya | Açıklama |
|-------|----------|
| [USER_STORIES.md](USER_STORIES.md) | Kullanıcı hikayeleri |
| [UI_SCREENS.md](UI_SCREENS.md) | Ekran tasarımları ve UI akışları |
| [COLLECTION_MODE.md](COLLECTION_MODE.md) | Tahsilat modu özellikleri |
| [CRM_INTEGRATION.md](CRM_INTEGRATION.md) | CRM entegrasyon noktaları |
| [ENTERPRISE_FEATURES.md](ENTERPRISE_FEATURES.md) | Kurumsal özellikler (multi-tenant, BI) |

## 🗺️ Yol Haritası & Strateji

| Dosya | Açıklama |
|-------|----------|
| [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) | Geliştirme yol haritası |
| [STRATEGIC_RECOMMENDATIONS.md](STRATEGIC_RECOMMENDATIONS.md) | Stratejik öneriler |
| [CHANGELOG.md](CHANGELOG.md) | Sürüm değişiklikleri (v1.0, v1.1, v1.2) |

## 🐛 Sorunlar & Çözümler

| Dosya | Açıklama |
|-------|----------|
| [SORUNLAR.md](SORUNLAR.md) | ⚠️ Tespit edilen 15 sorun ve çözümleri — KRİTİK KURALLAR dahil |
| [HATA_DUZELTME.md](HATA_DUZELTME.md) | Hata düzeltme notları |
| [CURSOR_STABILITY.md](CURSOR_STABILITY.md) | Cursor IDE kararlılık notları |

## 🤖 AI & Geliştirme

| Dosya | Açıklama |
|-------|----------|
| [CURSOR_CODING_GUIDE.md](CURSOR_CODING_GUIDE.md) | AI kodlama rehberi |
| [COPILOT_SESSION_HAFIZA.md](COPILOT_SESSION_HAFIZA.md) | Copilot oturum hafızası |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Katkı kuralları |
| [DERVISHIN_CEYIZI.md](DERVISHIN_CEYIZI.md) | Derviş çeyizi (proje başlangıç şablonu) |

## 📝 Diğer

| Dosya | Açıklama |
|-------|----------|
| [öner.md](öner.md) | Öneriler ve notlar |
| [readme.md](readme.md) | Ek README |
| [INDEX.md](INDEX.md) | Eski indeks (bu dosya güncel versiyondur) |

---

## 🔗 Root Dosyalar

Root dizinde **sadece 3 MD dosya** bulunur:
- `README.md` — Proje tanıtımı
- `DOSYA_YAPISI.md` — Dosya ağacı
- `emarecc_hafiza.md` — Proje hafızası (AI derviş için)

## 🔗 EMARE Ortak Dosyalar

Symlink üzerinden erişilir (`EMARE_ORTAK_CALISMA/`):
- `EMARE_ANAYASA.md` — Kodlama kuralları (18 madde)
- `EMARE_ORTAK_HAFIZA.md` — Ekosistem envanter
- `EMARE_AI_COLLECTIVE.md` — 18 AI perspektifi
- `SUNUCU_ALTYAPI.md` — Sunucu bilgileri (DC1/DC2/DC3)
