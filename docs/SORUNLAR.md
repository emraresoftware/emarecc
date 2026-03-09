# Çağrı Merkezi Platformu — Tespit Edilen Sorunlar

> Tarih: 5 Mart 2026 (Güncellenme: 9 Mart 2026)  
> Kapsam: FCT/GoIP trunk, Asterisk PJSIP, Backend Node.js, Frontend SIP.js

---

## 1. FCT Trunk — `AOR '' not found` Uyarısı (Kalıcı)

**Semptom:** Asterisk loglarında her 10 saniyede bir tekrarlayan:
```
WARNING: res_pjsip_registrar.c:1239 find_registrar_aor:
AOR '' not found for endpoint 'fct-trunk' (149.34.200.122:57547)
```
**Kök Neden:** FCT cihazı `sip_registrar` alanına Asterisk IP yerine dış IP (`78.47.33.186`) kayıtlı; cihaz Asterisk'e yanlış endpoint üzerinden register olmaya çalışıyor. `fct-aor` da boş AOR gönderdiği için eşleşemiyor.  
**Etki:** FCT yanlış IP'ye register olmaya çalıştığı için Asterisk loglarında her 10 saniyede bir `AOR '' not found` uyarısı üretiyor; outbound çağrılar ise `fct-aor` üzerindeki statik contact sayesinde artık endpoint üzerinden de yapılabiliyor.  
**Durum:** ✅ Çözüldü (6 Mart 2026) — FCT panelinde tüm `sip_registrar` alanları `192.168.1.64` olarak güncellendi, AOR ismi `fct-aor` → `fct-trunk` olarak düzeltildi, `identify` match'e Docker NAT IP `149.34.200.122` eklendi. REGISTER 200 OK, Contacts Reachable (~10ms RTT).

---

## 2. FCT Trunk — Dialplan Endpoint Üzerinden Çıkış Yapılamıyor

**Semptom:**
```
ERROR: res_pjsip.c:987 ast_sip_create_dialog_uac:
Endpoint 'fct-trunk': Could not create dialog to invalid URI 'fct-aor'.
```
**Kök Neden:** `fct-aor` içinde aktif/registered contact yok; FCT cihazı Asterisk'e hiç register olmamış.  
**Etki:** Her çağrıda endpoint dial başarısız, dialplan fallback route'a atlamak zorunda kalıyor.  
**Durum:** ✅ Çözüldü (6 Mart 2026) — GoIP16 artık Asterisk'e başarıyla register oluyor. AOR `fct-trunk` altında 2 contact mevcut (statik + dinamik). Fallback yedek olarak kalıyor.

---

## 3. FCT Cihazı — Line Port Seçimi (SIM1 Yerine Yanlış Port)

**Semptom:** Yalnızca Port 1'de SIM kart olmasına rağmen çağrılar zaman zaman diğer portlara dağıtılıyor; bu portlar GSM sinyali dönmediği için çağrı çalıyor gibi görünüp cevapsız kalıyor.  
**Kök Neden:** Asterisk dialplan'ı FCT'ye herhangi bir `gw_prefix` göndermiyordu; cihaz kendi round-robin algoritmasıyla port seçiyordu.  
**FCT Line Yapısı:** Line1 = Vodafone TR SIM (tek SIM), Line2-16 SIM yok (modüller kapalı).  
**Çözüm Uygulandı:** GoIP16 **Trunk Gateway Mode**'da çalışıyor. Bu modda prefix gerekmez — cihaz çağrıyı otomatik olarak aktif SIM olan Line 1'e yönlendirir. Dialplan'dan `G3687P07` prefix kaldırıldı, `Dial(PJSIP/${DST}@fct-trunk,30)` şeklinde doğrudan numara gönderiliyor.  
**Durum:** ✅ Çözüldü (7 Mart 2026).

---

## 4. Arama Başlatma — Sporadik `503` Hatası

**Semptom:** `POST /api/v1/calls/initiate` zaman zaman `503` ile dönüyor:
```
"Arama başlatılamadı. Sizin dahili (1001) veya aranan taraf santrale kayıtlı olmalı; softphone "Bağlı" olmalı."
```
**Kök Neden:** `initiateOutbound` içinde AMI ön-kontrol (`pjsip show endpoint`) trunk'ı `Unavailable` görünce exception fırlatıyor; oysa aynı deneme hemen ardından başarılı oluyor.  
**Çözüm Uygulandı:** Geçici (transient) hatalar için 700ms gecikmeli tek seferlik otomatik retry eklendi.  
**Durum:** Uygulandı.

---

## 5. Çağrı Kapatılınca FCT/GSM Tarafı Çalmaya Devam Ediyor

**Semptom:** Agent "Kapat" butonuna bastıktan sonra aranan GSM hattı çalmaya devam ediyor.  
**Kök Neden (çok katmanlı):**
1. Frontend'de `activeCallId` state bazen kayboluyordu; hangup isteği backend'e gitmiyordu.
2. Backend hangup fonksiyonu yalnızca agent kanalını kapatıyordu, FCT bacağı (`fct-trunk-XXXXXXXX`) aynı çağrıya bağlı olsa bile kapatılmıyordu.
3. `core show channels concise` çıktısında bridge bilgisi parse edilmiyordu.

**Çözümler Uygulandı:**
- Frontend: `handleHangup` içine `activeCallId` bulunamazsa `/calls/me/active` ile aktif çağrı ID'si çekip hangup gönderme eklendi.
- Backend `hangupCall`: hem agent hem de destination'a eşleşen `fct-trunk-*` kanalları ve bridged partner birlikte kapatılıyor.  
**Durum:** Uygulandı, kalıcı test bekleniyor.

---

## 6. DB'de Stale `ringing` / `initiating` Kayıtlar

**Semptom:** Çağrı PBX'te kapandığında DB kaydı `ringing` veya `initiating` durumunda takılı kalıyor. Sonraki arama girişiminde `409 — Aktif çağrı var` engeli çıkıyor.  
**Kök Neden:** AMI Hangup event'inin `asterisk_uniqueid` ile DB kaydını eşleştirememesi (uniqueid `unknown` geliyor).  
**Çözümler Uygulandı:**
- `asterisk_uniqueid` normalizasyonu (sadece `\d+\.\d+` formatındakiler kaydediliyor, `unknown` null'a dönüyor).
- AMI hangup handler'da extension bazlı fallback eşleme güçlendirildi.
- `/calls/initiate` başlangıcında 35 saniyelik stale cleanup sorgusu var.
- `runAmiCommand` ile aktif kanal kontrolü: kanal yoksa stale kayıt anında `failed`'a çekiliyor.  
**Durum:** Büyük ölçüde iyileşti, nadir edge-case hâlâ görülebilir.

---

## 7. Agent SIP Kaydı Zaman Zaman Düşüyor

**Semptom:** Agent12 softphone zaman zaman Asterisk'ten `Unregistered` durumuna düşüyor; manual yenileme gerekirken bazen birkaç dakika çevrimdışı kalıyor.  
**Kök Neden:** SIP.js re-registration mekanizması varsayılan ayarlarda connection hatalarından sonra yeterince agresif yeniden bağlanmıyordu.  
**Çözümler Uygulandı:**
- Exponential backoff (3s → max 30s) ile otomatik reconnect.
- `online` ve `visibilitychange` event'leri bağlandığında anında reconnect tetikliyor.
- Her 7 saniyede registration health check loop.  
**Durum:** Uygulandı.

---

## 8. `Nobody picked up in 30000 ms` — Çağrı Cevapsız Kapanıyor

**Semptom:** Arama doğru porta (`G3687P07` / Line1) gidiyor, FCT cihazına ulaşıyor (`Called PJSIP/fct-trunk/sip:...`) ama 30 sn sonra cevap alınamadan kapanıyor.  
**Kök Neden:** Birden fazla sorunun bileşimi: (a) yanlış sip_registrar IP'si, (b) AOR isim uyumsuzluğu, (c) Trunk GW modunda gereksiz prefix gönderilmesi, (d) sip_relay_server'da eski IP.  
**Çözümler Uygulandı (5-7 Mart 2026):**
- sip_registrar/proxy: `78.47.33.186` → `192.168.1.64`
- AOR: `fct-aor` → `fct-trunk`
- Prefix: `G3687P07` kaldırıldı
- sip_relay_server: temizlendi
- transport: `external_signaling_address` + `external_media_address` = `192.168.1.64`
- identify: `149.34.200.122` (Docker NAT) match eklendi  
**Test Sonucu:** Asterisk → GoIP16 → GSM → DIALING → ALERTING → CONNECTED (7 Mart 2026, 05327804227 test numarasına başarılı arama).  
**Durum:** ✅ Çözüldü.

---

## 9. FCT Cihazı `sip_registrar` Yanlış IP

**Semptom:** FCT panelinde `sip_registrar = 78.47.33.186` (dış IP / başka sunucu), `sip_proxy` boş.  
**Etki:** FCT, Asterisk'e değil farklı bir SIP sunucusuna kayıt olmaya çalışıyor.  
**Çözüm Uygulandı (6 Mart 2026):** GoIP16 web panelinde (http://192.168.1.100) 4 form (single, line, group, gateway) üzerindeki tüm `sip_registrar` ve `sip_backup_registrar` alanları `192.168.1.64` olarak değiştirildi. `sip_relay_server` (Advance VoIP) temizlendi.  
**Durum:** ✅ Çözüldü.

---

---

## 10. Hangup Butonu Çalışmıyor — Stale Closure

**Semptom:** Agent çağrıyı kapatmak istediğinde "Kapat" butonuna basıyor ama hiçbir şey olmuyor. Konsol loglarında `hangup() called` görünüyor ama `activeSession` veya `callState` stale/eski değer.  
**Kök Neden:** React state closure problemi. `hangup()` fonksiyonu component mount sırasındaki ilk state'i yakalayıp sonraki güncellemeleri görmüyordu. `callState` → `'idle'` ve `activeSession` → `null` kalıyordu hangup fonksiyonu içinde.  
**Çözüm Uygulandı (8 Mart 2026):**
- `useRef` ile `stateRef` oluşturuldu, `callState` + `activeSession` her değişimde `stateRef.current`'a yazılıyor.
- `hangup()` fonksiyonu artık closure state yerine `stateRef.current` okuyor.
```jsx
const stateRef = useRef({ callState, activeSession });
useEffect(() => { stateRef.current = { callState, activeSession }; }, [callState, activeSession]);

const hangup = useCallback(async () => {
  const { callState: cs, activeSession: sess } = stateRef.current;
  if (sess) { sess.hangup(); }
}, []);
```
**Dosya:** `frontend/src/context/SipContext.jsx`  
**Durum:** ✅ Çözüldü.

---

## 11. Hangup Fix Sonrası WebRTC Çağrıları Tamamen Çalışmıyor

**Semptom:** Sorun #10 fixlendikten sonra ne gelen ne giden çağrılar çalışıyor. `ensureRegistered()` hatası, eski session kalıntıları.  
**Kök Neden (3 katmanlı):**
1. `ensureRegistered()` UA'yı yeniden oluşturmaya çalışıyor ama `isConnected()` kontrolü yoktu — zaten bağlıyken tekrar connect ediyordu.
2. `call()` fonksiyonunda eski session cleanup'ı yoktu — önceki çağrının session nesnesine `.invite()` göndermeye çalışıyordu.
3. PJSIP `qualify_frequency=30` → Asterisk her 30 saniyede OPTIONS gönderiyor, SIP.js bunları yanlış yorumluyordu.

**Çözümler Uygulandı (8 Mart 2026):**
- `ensureRegistered()` içine `ua.isConnected()` kontrolü eklendi — bağlıysa skip.
- `call()` başında eski session varsa `dispose()` ile temizleniyor.
- PJSIP `qualify_frequency=0` yapıldı (agent endpoint için OPTIONS ping kapatıldı).

**Dosyalar:**
- `frontend/src/context/SipContext.jsx` — `ensureRegistered()`, `call()`
- `asterisk_config/pjsip.conf` — `[1000]` endpoint `qualify_frequency=0`  
**Durum:** ✅ Çözüldü.

---

## 12. "Too Many Requests" — Login ve API Rate Limit

**Semptom:** Frontend'ten login denemesinde veya debug endpoint'lerine istek atıldığında `429 Too Many Requests` hatası. Geliştirme ortamında sürekli tetikleniyor.  
**Kök Neden:** `express-rate-limit` varsayılan ayarı `max: 100` (15 dakikada 100 istek) çok düşüktü. Dev ortamında hot-reload sonrası hızlı istekler limiti aşıyordu.  
**Çözümler Uygulandı (8 Mart 2026):**
- Genel API rate limit: `max: 100` → `max: 3000` (15 dakikada 3000)
- Auth/login rate limit: `max: 50` (15 dakikada 50, güvenlik için ayrı)
- `/api/v1/debug/*` path'leri rate limiter'dan tamamen muaf tutuldu.

**Dosya:** `backend/src/index.ts`  
**Durum:** ✅ Çözüldü.

---

## 13. AMI Bağlantısı Docker Restart Sonrası Kopar — Auto-Reconnect Yok

**Semptom:** `docker compose up -d` ile güncelleme yapıldığında backend'in AMI bağlantısı kopuyor ve bir daha bağlanmıyor. "AMI connection closed" logu görünüyor ama yeniden bağlantı denemesi yok.  
**Kök Neden:** `asterisk-manager` kütüphanesi bağlantı koptuğunda otomatik yeniden bağlantı sağlamıyor. `close` ve `error` event handler'ları yoktu.  
**Çözüm Uygulandı (8 Mart 2026):**
- Exponential backoff ile auto-reconnect: 2s → 4s → 8s → max 30s
- `close` ve `error` event handler'ları eklendi
- `scheduleAmiReconnect()` fonksiyonu oluşturuldu
- Her başarılı bağlantıda backoff sıfırlanıyor
```typescript
function scheduleAmiReconnect() {
  const delay = Math.min(reconnectBase * Math.pow(2, reconnectAttempts), 30000);
  setTimeout(() => { reconnectAttempts++; connectAmi(); }, delay);
}
```
**Dosya:** `backend/src/services/ami.ts`  
**Durum:** ✅ Çözüldü.

---

## 14. ⚠️ KRİTİK — Docker Container ID, SIP.js'in TÜM Gelen Çağrıları Sessizce Reddetmesine Neden Oluyor

**Semptom:** Gelen çağrılarda Asterisk INVITE gönderiyor (WebSocket üzerinden), ama SIP.js tarafında HİÇBİR yanıt dönmüyor — 100 Trying yok, 180 Ringing yok, hata yok, log yok. Asterisk'te kanal durumu sürekli "Down" kalıyor. Agent'ın telefonu hiç çalmıyor.

**Tanı süreci:**
1. Asterisk loglarında `INVITE gönderildi ama yanıt yok` görülüyordu
2. WebSocket trafiği incelendi — INVITE mesajları browser'a ulaşıyordu
3. SIP.js `delegate.onCallReceived` hiç tetiklenmiyordu
4. Sorun SIP mesaj parse aşamasındaydı

**Kök Neden (RFC 3261 + SIP.js Grammar Parser):**
Docker, container'a otomatik olarak container ID'yi hostname olarak atar (ör: `906da5a2be30`). Bu ID, Asterisk'in GÖNDERDİĞİ TÜM SIP mesajlarının From URI ve Contact header'ında görünür:
```
From: <sip:1000@906da5a2be30>;tag=xyz
Contact: <sip:1000@906da5a2be30:5060;transport=ws>
```

**RFC 3261** `toplabel` kuralı hostname'in **harf ile başlamasını** zorunlu kılar:
```
toplabel = ALPHA / ALPHA *( alphanum / "-" ) alphanum
```

Docker container ID'si **rakam ile başladığı** (`906da5a2be30`) için RFC 3261'e göre **geçersiz hostname'dir**.

**SIP.js** (v0.21.1+) bünyesindeki PEG.js Grammar parser bu kuralı kesinlikle uygular:
```javascript
Grammar.parse('sip:test@906da5a2be30', 'SIP_URI')  → -1  // BAŞARISIZ
Grammar.parse('sip:test@asterisk.local', 'SIP_URI') → URI object  // BAŞARILI
```

Parser `-1` döndüğünde SIP.js mesajı **sessizce düşürür** — exception fırlatmaz, log yazmaz, hiçbir ipucu vermez.

**FİX (8 Mart 2026):**

**1. docker-compose.yml — Asterisk servisine hostname eklendi (ANA FİX):**
```yaml
asterisk:
  image: andrius/asterisk:latest
  hostname: asterisk.local        # ← BU SATIR KRİTİK
  container_name: emarecc-asterisk
```

**2. pjsip.conf — WSS/WS transportlarına external adresler eklendi:**
```ini
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
cert_file=/etc/asterisk/keys/asterisk.crt
priv_key_file=/etc/asterisk/keys/asterisk.key
external_media_address=192.168.1.64
external_signaling_address=192.168.1.64
local_net=172.19.0.0/16
local_net=127.0.0.0/8

[transport-ws]
type=transport
protocol=ws
bind=0.0.0.0:8088
external_media_address=192.168.1.64
external_signaling_address=192.168.1.64
local_net=172.19.0.0/16
local_net=127.0.0.0/8
```

**3. extensions.conf — Ringing() eklendi:**
```conf
[from-pstn]
exten => s,1,NoOp(Gelen arama: ${CALLERID(num)})
same => n,Set(CALLERID(name)=${CALLERID(num)})
same => n,Ringing()                              ; ← GoIP16'ya 180 gönder
same => n,Queue(cc-support,t,,,60)
same => n,Hangup()
```

**UYARI (ASLA UNUTMA):**
- `hostname: asterisk.local` satırı docker-compose.yml'den **ASLA** silinmemeli
- Bu satır olmadan Docker container ID hostname olarak kullanılır ve SIP.js tüm gelen çağrıları sessizce reddeder
- Hata mesajı, exception, log **HİÇBİR ŞEKİLDE** görünmez — tamamen sessiz başarısızlık

**Test komutu (doğrulama):**
```bash
docker compose exec asterisk hostname  # "asterisk.local" dönmeli
```

**Dosyalar:** `docker-compose.yml`, `asterisk_config/pjsip.conf`, `asterisk_config/extensions.conf`  
**Durum:** ✅ Çözüldü (8 Mart 2026). Gelen + Giden çağrılar test edildi, tam çalışıyor.

---

## 15. Nginx Cache — Frontend Güncellemeleri Yansımıyor

**Semptom:** Frontend kodu güncellendikten sonra tarayıcı eski versiyonu gösteriyor. Hard refresh (Ctrl+Shift+R) bile her zaman çözmüyor.  
**Kök Neden:** Nginx `index.html` dosyasını cache'liyor; browser eski JS bundle referansı olan HTML'i kullanıyor.  
**Çözüm Uygulandı (8 Mart 2026):**
```nginx
location = /index.html {
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}
```
**Dosya:** `docker/nginx/default.conf`  
**Durum:** ✅ Çözüldü.

---

## 16. Tek Yönlü Ses — RTP Port Aralığı Uyuşmazlığı

**Semptom:** Bilgisayardan telefona ses geçiyor ama telefondan bilgisayara ses gelmiyor (tek yönlü ses).  
**Kök Neden:** Asterisk varsayılan RTP port aralığı 5000-31000, ancak Docker sadece 10000-10020/udp portlarını dışarı açıyordu. GoIP16'dan gelen RTP paketleri Asterisk'in 10020'nin üzerinde seçtiği RTP portuna ulaşamıyordu.  
**Çözüm Uygulandı (8-9 Mart 2026):**

1. `asterisk_config/rtp.conf` oluşturuldu:
```ini
[general]
rtpstart=10000
rtpend=10050
strictrtp=yes
icesupport=yes
```

2. `docker-compose.yml` port mapping güncellendi:
```yaml
ports:
  - "10000-10050:10000-10050/udp"   # RTP (rtp.conf ile eşleşmeli!)
```

**UYARI:** `rtp.conf` port aralığı ile `docker-compose.yml` UDP port mapping **BİREBİR EŞLEŞMELİ**. Eşleşmezse tek yönlü ses sorunu geri döner.  
**Dosyalar:** `asterisk_config/rtp.conf`, `docker-compose.yml`  
**Durum:** ✅ Çözüldü (9 Mart 2026). Çift yönlü ses doğrulandı — telefon ↔ bilgisayar tam çalışıyor.

---

## Özet Tablo

| # | Sorun | Durum |
|---|-------|-------|
| 1 | FCT AOR `''` not found uyarısı | ✅ Çözüldü (6 Mart) — Register 200 OK |
| 2 | Endpoint üzerinden dial başarısız | ✅ Çözüldü — dinamik + statik contact |
| 3 | Yanlış FCT port seçimi | ✅ Çözüldü (7 Mart) — Trunk GW Mode, prefix kaldırıldı |
| 4 | Sporadik `503` arama başlatma hatası | ✅ Çözüldü — retry mekanizması |
| 5 | "Kapat" sonrası FCT çalmaya devam | ✅ Büyük ölçüde çözüldü |
| 6 | DB stale `ringing` kaydı / 409 kilidi | ✅ Büyük ölçüde çözüldü |
| 7 | Agent SIP register düşmesi | ✅ Çözüldü — auto-reconnect |
| 8 | 30sn sonra cevapsız kapanma | ✅ Çözüldü (7 Mart) — Tüm SIP+GSM sorunları giderildi |
| 9 | FCT `sip_registrar` yanlış IP | ✅ Çözüldü (6 Mart) — 192.168.1.64 yapıldı |
| 10 | Hangup butonu stale closure | ✅ Çözüldü (8 Mart) — stateRef pattern |
| 11 | Hangup fix sonrası çağrılar çalışmıyor | ✅ Çözüldü (8 Mart) — isConnected, qualify_frequency=0 |
| 12 | Too Many Requests / rate limit | ✅ Çözüldü (8 Mart) — max:3000, /debug muaf |
| 13 | AMI auto-reconnect eksildi | ✅ Çözüldü (8 Mart) — exponential backoff |
| 14 | ⚠️ Docker hostname → SIP.js sessiz ret | ✅ Çözüldü (8 Mart) — `hostname: asterisk.local` |
| 15 | Nginx cache / frontend güncellenmeme | ✅ Çözüldü (8 Mart) — no-cache header |
| 16 | Tek yönlü ses (RTP port uyuşmazlığı) | ✅ Çözüldü (9 Mart) — rtp.conf 10000-10050 |

## Not: GoIP16 Donanım Bilgisi
- **Aktif SIM:** Sadece Line 1 (Vodafone TR, sinyal ~20)
- **Line 2-16:** SIM yok, modüller kapalı (down)
- **Mod:** Trunk Gateway Mode
- **IP:** 192.168.1.100 (Web: admin/admin)

---

## ⚠️ KRİTİK KURALLAR — ASLA BOZMA

Bu kurallar ihlal edilirse sistem sessizce çöker ve hata bulmak saatler/günler alır:

1. **`hostname: asterisk.local`** docker-compose.yml'deki asterisk servisinden ASLA silinmemeli (Sorun #14)
2. **`external_media_address` ve `external_signaling_address`** pjsip.conf'taki WSS/WS transportlarından ASLA silinmemeli
3. **`Ringing()`** extensions.conf'ta Queue() öncesinden ASLA silinmemeli
4. **`qualify_frequency=0`** WebRTC endpoint (1000) için sıfır kalmalı
5. **`manager.conf` secret** docker-compose.yml'deki `AMI_SECRET` ile eşleşmeli
6. **`rtp.conf` port aralığı = Docker UDP mapping** `rtpstart-rtpend` ile `docker-compose.yml` port mapping birebir eşleşmeli (şu an 10000-10050). Eşleşmezse tek yönlü ses.
