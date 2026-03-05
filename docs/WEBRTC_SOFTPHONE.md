# WebRTC Softphone (SIP.js) Gereksinimleri

Faz 3 kapsamında tarayıcıdan direkt arama alıp cevaplamak için WebRTC + SIP.js entegrasyonu gerekir.

## Önkoşullar

1. **Asterisk WebRTC/PJSIP** ayarları (SETUP_GUIDE.md)
   - `http.conf`: WebSocket (8088), WSS (8089)
   - `pjsip.conf`: WebRTC transport, DTLS-SRTP, codec (Opus/G.711)
   - HTTPS (localhost hariç mikrofon için zorunlu)

2. **Sertifika**
   - Lokal: `mkcert localhost`
   - Production: Geçerli TLS sertifikası

## Teknik Akış

```
[SIP.js] ↔ WSS ↔ [Asterisk chan_pjsip] ↔ [Dahili/SIP trunk]
```

- Tarayıcı SIP.js UserAgent ile Asterisk'e WSS üzerinden kayıt
- Extension + secret (PJSIP endpoint) ile REGISTER
- Gelen arama: INVITE → Session.answer()
- Giden arama: UserAgent.invite()
- Mute: Session.mute() / unmute()

## Yapılanlar

- [x] `sip.js` paket kurulumu
- [x] SipContext/SipProvider: connect, register, call state
- [x] Gelen arama: INVITE handler → SipIncomingModal Cevap/Reddet UI
- [x] Mute/Unmute: SimpleUser.mute() / unmute() — SoftphoneWidget'da buton
- [ ] Asterisk PJSIP endpoint + auth (extension + secret) yapılandırması — VITE_SIP_WS_URL, VITE_SIP_DOMAIN, VITE_SIP_SECRET

## API Değişikliği

Şu an: Click-to-Call AMI Originate (fiziksel/SIP telefon aranıyor)  
WebRTC sonrası: Tarayıcı doğrudan SIP session, AMI yalnızca CDR/event için.

## GoIP/FCT Dış Arama Checklist (Canlı Operasyon)

Bu liste, "çağrı trunk'a düşüyor ama dış hat çalmıyor" durumunda hızlı teşhis içindir.

### 1) GoIP Web UI

- `Config Mode`: **Trunk Gateway Mode**
- `SIP Trunk Gateway1`: **Asterisk host IP** (ör: `192.168.1.64`)
- `Authentication ID`: `fct-trunk`
- `Password`: `fct123`
- Advanced SIP:
   - `Port`: `5060`
   - `Call OUT Auth Mode`: **IP**
   - `DTMF`: RFC2833

### 2) Asterisk Trunk Doğrulama

- `pjsip.conf` içinde:
   - endpoint: `fct-trunk`
   - aor: `fct-aor`
   - identify: `fct-identify` (`match=192.168.1.100`)
- `extensions.conf` dış arama kuralı:
   - `_9.` için `Dial(PJSIP/fct-trunk/sip:${EXTEN:1}@192.168.1.100:5060,30)`

### 3) Çalıştırılacak Komutlar

- Trunk objeleri:
   - `docker compose exec -T asterisk asterisk -rx "pjsip show endpoint fct-trunk"`
   - `docker compose exec -T asterisk asterisk -rx "pjsip show aor fct-aor"`
   - `docker compose exec -T asterisk asterisk -rx "pjsip show identifies"`
- Çağrı anı log:
   - `docker compose logs asterisk --since=2m | grep -Ei "Dis arama|fct-trunk|Dial\(|Called|Hangup"`

### 4) Beklenen Doğru Akış

- API: `/api/v1/calls/initiate` => `201`
- Asterisk logda sırasıyla:
   - `NoOp(... "Dis arama: ...")`
   - `Dial(... PJSIP/fct-trunk/sip:<numara>@192.168.1.100:5060,30)`
   - `Called PJSIP/fct-trunk/...`

### 5) Sık Hata ve Anlamı

- `401` (web): oturum/token sorunu
- `504` (web): backend çağrı başlatmada asılı kalma (timeout fix uygulanmış olmalı)
- `Could not create dialog to invalid URI 'fct-aor'`: trunk URI/routing hatası
- `Endpoint ... not found`: ilgili dahili PJSIP endpoint tanımlı değil

### 6) Operasyon Notu

- Dış aramada kullanıcı numaranın başına `9` yazmaz; sistem trunk için prefiksi otomatik uygular.
- Click-to-call akışında önce agent dahili çalar; agent cevaplayınca dış bacak aranır.

### 7) Son Mil (SIM/Operatör) Canlı Test Checklist

Routing doğru olup çağrı yine dış hatta düşmüyorsa, sorun çoğunlukla GoIP/SIM/operatör tarafındadır.

#### A) GoIP cihaz üstü kontrol

- SIM kart takılı ve PIN kilidi kapalı olmalı.
- Cihaz ekranında/arayüzde GSM sinyal seviyesi yeterli olmalı.
- Hat bakiyesi/paket ve operatör kısıtı (yalnız veri hattı, yalnız belirli yön vb.) kontrol edilmeli.
- Aynı SIM ile cihazdan manuel test araması yapılabiliyorsa SIP katmanı dışı sorun azalır.

#### B) Numara formatı

- Hedef numarayı UI'da normal gir (`053...` veya `9053...`).
- Sistem normalize ederek trunk'a gönderir; kullanıcı başına ekstra prefix eklemez.

#### C) Asterisk logda aranan kanıt satırlar

- `NoOp(... "Dis arama: ...")`
- `NoOp(... "FCT normalize hedef: ...")`
- `Dial(... PJSIP/fct-trunk/sip:<numara>@192.168.1.100:5060,30)`
- `Called PJSIP/fct-trunk/...`

Bu dört satır varsa çağrı GoIP'e ulaşmıştır; bundan sonrası GSM/operatör katmanıdır.

#### D) Sonuç yorumu

- 30 sn sonunda kapanıyorsa: karşı taraf çalmıyor/cevaplamıyor veya operatör yönlendirmeyi tamamlamıyor olabilir.
- Hızlı düşüyorsa: SIM yetkisi, operatör blokesi veya GoIP line ayarı kontrol edilmeli.

#### E) Hızlı izolasyon testi

1. Aynı hedef numarayı GoIP web arayüzünden yerel test aramasıyla dene.
2. Aynı anda Asterisk logunu izle.
3. GoIP yerel test başarılı, Asterisk üzerinden başarısızsa SIP kimlik/route farkı vardır.
4. Her ikisi de başarısızsa sorun GSM hattı veya operatör tarafındadır.
