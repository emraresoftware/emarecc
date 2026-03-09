# OpenCC - Çağrı Merkezi

Docker üzerinde çalışan, Asterisk tabanlı, modern çağrı merkezi yazılımı.

## Özellikler

- **Auth:** JWT giriş, rol tabanlı erişim (admin, supervisor, agent)
- **Müşteri Yönetimi:** CRUD, notlar, çağrı geçmişi, borç alanları
- **Screen Pop:** Gelen aramada CallerID ile müşteri eşleme, bilinmeyen arayan formu, disposition kodları
- **Tahsilat Script:** Müşteri borçlu ise yasal metin gösterimi (placeholder destekli)
- **Click-to-Call:** Softphone + müşteri detaydan AMI Originate ile arama
- **Preview Dialer:** Kampanya bazlı borçlu listesi, sıradaki numarayı ara
- **Wallboard:** Gerçek zamanlı ajan durumları (WebSocket)
- **CDR Raporları:** Filtreleme, CSV indirme, ses kaydı dinleme, AI transkripsiyon (OpenAI Whisper)
- **Admin Panel:** Kullanıcılar, kuyruklar, kampanyalar, scriptler, ayarlar

## Hızlı Başlangıç

```bash
# 1. Tüm servisleri tek komutla başlat (db, redis, asterisk, backend, worker, frontend)
./start.sh
# veya: docker compose up -d

# 2. İlk kurulumda seed (admin/admin123, agent1/admin123)
docker compose exec backend npm run seed

# Mevcut kurulum için migration:
# docker compose exec backend npm run migrate
```

- **Frontend:** http://localhost:3080
- **Backend API:** http://localhost:5001

## Giriş Bilgileri

| Kullanıcı | Şifre | Rol |
|-----------|-------|-----|
| admin | admin123 | admin |
| agent1 | admin123 | agent |

## Gelen Çağrı (Kuyruk)

Müşteri aradığında çağrı **cc-support** kuyruğuna düşer ve tanımlı dahililere (varsayılan: 1000, 1001, 1002, 1003) çalar. Açan ajan görüşmeyi alır. Kuyruk üyeleri `asterisk_config/queues.conf` içinde `member => PJSIP/ext-XXXX` olarak tanımlıdır; yeni dahili eklediğinizde bu dosyaya ekleyip Asterisk’i yeniden yükleyin: `docker compose exec asterisk asterisk -rx "queue reload"`.

## Test Screen Pop

Agent girişi → Dashboard → "Test Screen Pop" butonu (Asterisk olmadan simülasyon)

## E2E Testler

```bash
# Backend ve DB çalışıyor olmalı
docker compose up -d db redis backend
docker compose exec backend npm run seed

cd frontend && npm run test:e2e
```

Test dosyaları: `frontend/e2e/` — login, reports, customers, scripts

## Dokümantasyon

Tüm detaylar `docs/` klasöründe: [docs/INDEX.md](docs/INDEX.md)

## WebRTC Stabilite Notu (Önemli)

Yaşanan "WebRTC hazır değil" sorununun kalıcı notları ve önleme checklist'i:

- [docs/WEBRTC_STABILITY.md](docs/WEBRTC_STABILITY.md)

Kısa özet:

- Dahili arama için SIP tarafı `/ws` üstünden register olmalıdır.
- Local build akışında `VITE_SIP_SECRET` boş kalırsa SIP hiç başlamaz.
- Kodda güvenli fallback aktif: `frontend/src/context/SipContext.jsx` içinde `VITE_SIP_SECRET || 'webrtc123'`.
- Canlı takip için script: `./scripts/live-logs.sh --since 5m web backend asterisk`

## Production (HTTPS/WSS)

```bash
# SSL sertifikaları: docker/ssl/cert.pem, docker/ssl/key.pem
export DOMAIN=callcenter.example.com
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Detay: [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md)

## AI Transkripsiyon (Opsiyonel)

Çağrı bitiminde otomatik metin üretimi (OpenAI Whisper).

```bash
# .env: OPENAI_API_KEY=sk-...
docker compose up -d db redis backend worker

# Worker ayrı çalıştırmak için:
docker compose up -d worker
```

Raporlar sayfasında kayıtlı çağrılar için "Transkript Al" ile manuel tetikleme de mümkün.

## Wallboard TV Modu

Login olmadan TV/ekranda gösterim: `/wallboard/public?token=TOKEN`  
Token: Ayarlar → Wallboard Public Token

## v1.0 Release

`docs/CHANGELOG.md` için sürüm geçmişi.
