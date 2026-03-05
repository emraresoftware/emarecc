# Çağrı Merkezi Platformu — Tespit Edilen Sorunlar

> Tarih: 5 Mart 2026  
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
**Durum:** Kısmi — Fonksiyonel olarak çözüldü (endpoint dial çalışıyor), log uyarısının tamamen kaybolması için FCT panelinde `sip_registrar` ve `sip_proxy` ayarlarının 9. maddede tarif edildiği gibi Asterisk'in yerel IP'sine (`192.168.1.X:5060`) çevrilmesi gerekiyor.

---

## 2. FCT Trunk — Dialplan Endpoint Üzerinden Çıkış Yapılamıyor

**Semptom:**
```
ERROR: res_pjsip.c:987 ast_sip_create_dialog_uac:
Endpoint 'fct-trunk': Could not create dialog to invalid URI 'fct-aor'.
```
**Kök Neden:** `fct-aor` içinde aktif/registered contact yok; FCT cihazı Asterisk'e hiç register olmamış.  
**Etki:** Her çağrıda endpoint dial başarısız, dialplan fallback route'a atlamak zorunda kalıyor.  
**Durum:** Çözüldü — `fct-aor` için statik contact (`sip:192.168.1.100:5060`) tanımlandı, endpoint üzerinden dial çalışıyor; dialplan'deki fallback `sip:DST@192.168.1.100:5060` yedek olarak bırakıldı.

---

## 3. FCT Cihazı — Line Port Seçimi (SIM1 Yerine Yanlış Port)

**Semptom:** Yalnızca Port 1'de SIM kart olmasına rağmen çağrılar zaman zaman diğer portlara dağıtılıyor; bu portlar GSM sinyali dönmediği için çağrı çalıyor gibi görünüp cevapsız kalıyor.  
**Kök Neden:** Asterisk dialplan'ı FCT'ye herhangi bir `gw_prefix` göndermiyordu; cihaz kendi round-robin algoritmasıyla port seçiyordu.  
**FCT Line Yapısı:** Line1 = `G3687P07` (SIM var), Line2-16 arasında birkaç line daha tanımlı ama SIM kart yok.  
**Çözüm Uygulandı:** Dialplan'a `Set(FCT_GW_PREFIX=G3687P07)` eklendi, tüm dış aramalar zorunlu olarak Line1 prefix ile gönderiliyor.  
**Durum:** Uygulandı, yeni aramalar Line1 prefix ile gidiyor.

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
**Kök Neden:** FCT cihazı SIP INVITE aldıktan sonra GSM şebekesine çağrıyı iletemiyor ya da geç illetiyor; 180 Ringing sinyali Asterisk'e dönmüyor.  
**Olası Nedenler:**
- GSM sinyal problemi / SIM kart network kayıt sorunu.
- FCT'de line yetki/prefix eşleşme sorunu (gw_prefix formatı).  
**Durum:** Açık — Line1 prefix zorlaması uygulandı, ancak GSM şebekesi çekim/kayıt durumu FCT cihazının fziksel ortamına bağlı.

---

## 9. FCT Cihazı `sip_registrar` Yanlış IP

**Semptom:** FCT panelinde `sip_registrar = 78.47.33.186` (dış IP / başka sunucu), `sip_proxy` boş.  
**Etki:** FCT, Asterisk'e değil farklı bir SIP sunucusuna kayıt olmaya çalışıyor. Bu yüzden Asterisk'in `fct-aor`'unda hiç contact oluşmuyor.  
**Çözüm Önerisi:** FCT cihazında `sip_registrar` ve `sip_proxy` alanlarını Asterisk'in yerel IP'si (`192.168.1.X:5060`) olarak ayarla.  
**Durum:** Manuel panel müdahalesi gerekiyor (yazılım katmanından yapılamaz).

---

## Özet Tablo

| # | Sorun | Durum |
|---|-------|-------|
| 1 | FCT AOR `''` not found uyarısı | Kısmi — FCT register etmiyor |
| 2 | Endpoint üzerinden dial başarısız | ✅ Çözüldü — statik contact + fallback |
| 3 | Yanlış FCT port seçimi | ✅ Çözüldü — Line1 prefix zorunlu |
| 4 | Sporadik `503` arama başlatma hatası | ✅ Çözüldü — retry mekanizması |
| 5 | "Kapat" sonrası FCT çalmaya devam | ✅ Büyük ölçüde çözüldü |
| 6 | DB stale `ringing` kaydı / 409 kilidi | ✅ Büyük ölçüde çözüldü |
| 7 | Agent SIP register düşmesi | ✅ Çözüldü — auto-reconnect |
| 8 | 30sn sonra cevapsız kapanma | Açık — GSM/FCT fiziksel sorun |
| 9 | FCT `sip_registrar` yanlış IP | Açık — manuel cihaz ayarı gerekli |
