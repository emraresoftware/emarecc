# Hata Düzeltme Günlüğü

## 8 Mart 2026

---

### 1. "Too many requests" — Admin Giriş Yapamıyor

**Belirti:** Admin paneline giriş yapmaya çalışınca `Too many requests` hatası alınıyor.

**Kök Neden:** `express-rate-limit` middleware'i tüm `/api/v1/` endpointlerine 15 dakikada **1000 istek** sınırı koymuştu. Ancak:
- Loglar sayfası her 3 saniyede `/debug/logs`, `/debug/asterisk`, `/debug/asterisk-logs`, `/debug/call-health` polling yapıyor (4 istek × 20/dk = 80 istek/dk)
- SoftphoneWidget `syncActiveCall` 5 saniyede bir polling yapıyor
- Diğer sayfa yüklemeleri (customers, calls, users, stats vb.)
- **15 dakikada toplam ~1200+ istek** oluşuyordu → limit doluyordu → login dahil tüm istekler bloklanıyordu

**Çözüm:**
1. API rate limit 1000 → **3000** çıkarıldı (`RATE_LIMIT_MAX` env var)
2. `/api/v1/debug/*` endpointleri rate limit'ten **muaf tutuldu** (polling endpointleri)
3. Rate limiter middleware sırası düzeltildi: debug bypass → genel limiter

**Değişen Dosya:** `backend/src/index.ts` satır 45-51

**Doğrulama:** Backend restart sonrası admin login başarılı.

---

### 2. Gelen Aramada Kanal "Down" Kalıyor — 180 Ringing Eksik

**Belirti:** GoIP16'dan gelen arama Queue(cc-support) üzerinden 1000'i çağırıyor, ancak `PJSIP/1000` kanalı `Down` durumunda kalıyor. 13 saniye sonra GoIP16 aramayı CANCEL ediyor (SIP 487).

**Kök Neden:** SIP.js `SimpleUser`, gelen INVITE aldığında otomatik olarak sadece SIP `100 Trying` gönderiyor. Asterisk ise `PJSIP/1000` kanalını **Ringing** durumuna geçirmek için `180 Ringing` yanıtı bekliyor. 180 gelmeyince:
- Kanal `Down` durumunda takılı kalıyordu
- Asterisk, GoIP16'ya early media/ringing sinyali veremiyordu
- GoIP16 (veya arayan operatör) timeout ile aramayı iptal ediyordu

**Çözüm:** `onCallReceived` handler'ına `session.progress()` çağrısı eklendi. Bu, SIP.js'in **180 Ringing** provisional response göndermesini sağlıyor.

**Değişen Dosya:** `frontend/src/context/SipContext.jsx` — `onCallReceived` callback'i

**Doğrulama:** Yeni INVITE'larda 180 Ringing gönderilip Asterisk kanalının `Ringing` durumuna geçmesi bekleniyor.

---

### 3. Hangup Butonu Çağrıyı Sonlandırmıyor

**Belirti:** Aktif çağrıda "Kapat" butonuna basınca çağrı sonlanmıyordu.

**Kök Neden:** `hangup()` fonksiyonu React `state` değişkenini closure üzerinden okuyordu. `state` closure'da eski değer ("registered" veya "calling") olarak kalıyordu, bu yüzden koşul kontrolleri yanlış çalışıyordu. Ayrıca `finally` bloğu her durumda `setState('registered')` yapıyordu — bağlantı kopmuşken bile.

**Çözüm:**
1. `stateRef.current` kullanılarak her zaman güncel state okunması sağlandı
2. `hangup()` sadece çağrı durumlarını (`calling`, `incoming`, `connected`) sıfırlıyor
3. `finally` bloğu artık `disconnected`/`connecting` state'lerini değiştirmiyor

**Değişen Dosya:** `frontend/src/context/SipContext.jsx` — `hangup()` fonksiyonu

---

### 4. Hangup Fix Sonrası Arama Yapılamıyor

**Belirti:** Hangup düzeltmesinden sonra hiç arama yapılamıyordu.

**Kök Neden:** Üç ayrı sorun:
1. **hangup() stale closure:** Yanlış state okuması, reconnect akışını bozuyordu
2. **ensureRegistered() React state'e güvenme:** `state === 'registered'` kontrol ediyordu ama gerçek WebSocket bağlantısı kopmuş olabiliyordu
3. **PJSIP qualify_frequency=30:** Asterisk her 30 saniyede OPTIONS gönderiyor → Nginx WSS proxy üzerinden yanıt alamıyor → endpoint 1000 "Unavailable" oluyor → Queue bu üyeyi atlıyor

**Çözüm:**
1. `stateRef` ile güncel state okunması
2. `simpleUser.isConnected()` ile gerçek WebSocket durumu kontrolü
3. `qualify_frequency=0` (webrtc-aor template) — passive qualify

**Değişen Dosyalar:**
- `frontend/src/context/SipContext.jsx` — `hangup()`, `ensureRegistered()`, `call()`
- `asterisk_config/pjsip.conf` — `webrtc-aor` template: `qualify_frequency=0`

---

### 5. Asterisk Logları Backend Endpoint Hatası

**Belirti:** `/api/debug/asterisk-logs` endpoint'i 404 veya "require is not defined" hatası veriyordu.

**Kök Neden:** İki sorun:
1. **Route sırası:** `export default router;` satırı `/asterisk-logs` route tanımından ÖNCE yazılmıştı
2. **ESM uyumsuzluğu:** `require('fs').openSync()` kullanılmıştı ama proje ESM modül sistemi kullanıyor → `require is not defined` hatası

**Çözüm:**
1. `export default router;` dosyanın en sonuna taşındı
2. `openSync`, `readSync`, `closeSync` import edildi (ESM `import` ile)

**Değişen Dosya:** `backend/src/routes/debug.ts`

---

## Genel Notlar

| Parametre | Eski Değer | Yeni Değer | Neden |
|-----------|-----------|-----------|-------|
| RATE_LIMIT_MAX | 1000 | 3000 | Polling endpointleri limiti tüketiyor |
| qualify_frequency (webrtc-aor) | 30 | 0 | Nginx proxy üzerinden qualify çalışmıyor |
| debug endpointleri | rate limited | exempt | Sürekli polling yapıyorlar |

### Polling Yükü Hesabı
- Logs sayfası açıkken: ~4 istek/3sn = 80 istek/dk = **1200 istek/15dk**
- SyncActiveCall: 1 istek/5sn = 12 istek/dk = **180 istek/15dk**
- Sayfa navigasyonu + diğer: ~100 istek/15dk
- **Toplam: ~1480 istek/15dk** → Eski limit (1000) yetersizdi
