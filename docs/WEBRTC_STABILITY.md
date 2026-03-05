# WebRTC Stabilite Notları

Bu belge, yaşanan **"WebRTC hazır değil. Dahili arama için softphone kayıtlı olmalı."** sorununun tekrarını önlemek için hazırlanmıştır.

## Kök Neden (RCA)

- Dahili arama akışı SIP.js üzerinden `wss://<host>/ws` ile register olup çağrı başlatır.
- `hasConfig = WS_URL && SIP_SECRET && extension` koşulu sağlanmazsa SIP başlatılmaz.
- Lokal akışta (`cd frontend && npm run build`) `frontend/.env` olmadığı için `VITE_SIP_SECRET` boş gelebilir.
- Sonuç: SIP register başlamaz, `/ws` trafiği düşer ve UI "WebRTC hazır değil" hatası verir.

## Uygulanan Kalıcı Önlem

- `frontend/src/context/SipContext.jsx`:
  - `SIP_SECRET` fallback eklendi:
    - `const SIP_SECRET = import.meta.env.VITE_SIP_SECRET || 'webrtc123';`
- SIP kopmalarında otomatik yeniden bağlanma denemeleri güçlendirildi.
- Dahili çağrıdan önce on-demand `ensureRegistered()` ile register doğrulaması eklendi.

## Operasyon Checklist (Release Öncesi)

1. Aktif bundle doğrula:
   - `curl -sk https://localhost:3783/login | grep -oE 'src="/assets/index-[^"]+\.js"'`
2. SIP fallback/bundle kontrolü:
   - `node -e "const fs=require('fs');const p='frontend/dist/assets';const f=fs.readdirSync(p).filter(x=>x.startsWith('index-')&&x.endsWith('.js')).sort().at(-1);const s=fs.readFileSync(p+'/'+f,'utf8');console.log(f,s.includes('/ws'),s.includes('webrtc123'));"`
3. Asterisk register kontrolü:
   - `docker compose exec -T asterisk asterisk -rx "pjsip show contacts"`
   - `1001` (agent12) ve `1000` (admin) contact görünmeli.

## Canlı Log İzleme ve Kayıt

Script:

- `scripts/live-logs.sh`

Kullanım:

- `./scripts/live-logs.sh --since 5m web backend asterisk`

Çıktı:

- Ekrana canlı akar.
- Aynı anda `logs/live/live-YYYYMMDD-HHMMSS.log` dosyasına yazılır.

## Hızlı Teşhis Sinyalleri

- **Backend:** `[AUTH] login_success { username: 'agent12' ... }`
- **Web (nginx):** `GET /ws` için `101` görünüyor olmalı.
- **Asterisk:** `Added contact ... to AOR '1001'` ve `Endpoint 1001 is now Reachable`.

## Tekrar Yaşanmaması İçin Kural

- Frontend release build'de SIP secret'ın boş gelmeyeceği varsayımı yapılmamalı.
- Build yönteminden bağımsız olarak (`docker compose build` veya lokal `npm run build`) SIP başlatma koşulları çalışır kalmalı.
