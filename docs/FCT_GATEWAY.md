# FCT / PSTN Gateway Kurulum Rehberi

Bu rehber, FCT veya benzeri PSTN (SIP-to-FXO) cihazlarının Asterisk'e bağlanması ve gelen çağrıların OpenCC kuyruğuna yönlendirilmesi için gereken adımları içerir.

## Genel Akış

```
[PSTN Telefon Hattı] <--> [FCT Gateway] <--SIP--> [Asterisk] <--AMI--> [OpenCC]
```

FCT cihazı PSTN hattına fiziksel bağlanır, gelen çağrıları SIP üzerinden Asterisk'e iletir. Asterisk ise AMI ile OpenCC'ye bildirir ve çağrı kuyruğa düşer.

---

## 1. FCT Cihazının IP Ayarı

FCT cihazınıza (FCT-32T, FCT-70, vb.) web arayüzü veya seri konsol ile erişin. Örnek:

- Varsayılan IP: `192.168.1.100` (modeline göre değişir)
- Tarayıcıda `http://192.168.1.100` açın

**Yapılacaklar:**
- Cihaza sabit bir IP atayın veya DHCP rezervasyonu yapın
- Asterisk sunucusu ile aynı ağda olduğundan emin olun

---

## 2. FCT SIP Ayarları (FCT → Asterisk Kayıt)

FCT cihazının **Asterisk'e kayıt olması** (register) gerekiyorsa:

### FCT Tarafı:
- **SIP Server (Registrar):** Asterisk sunucu IP (örn. `192.168.1.10`)
- **SIP Port:** `5060` (UDP)
- **SIP User / Auth User:** `fct-trunk`
- **Password:** Güçlü bir şifre belirleyin
- **Outbound Proxy:** (Boş bırakılabilir veya Asterisk IP)

### Asterisk Tarafı (`asterisk_config/pjsip.conf`):

Aşağıdaki bölümleri mevcut `pjsip.conf` dosyasına ekleyin:

```ini
; ========== FCT / PSTN Trunk ==========
[fct-trunk]
type=endpoint
context=from-pstn
disallow=all
allow=ulaw
allow=alaw
allow=gsm
auth=fct-auth
aors=fct-aor
direct_media=no

[fct-auth]
type=auth
auth_type=userpass
username=fct-trunk
password=ŞIFRENIZI_YAZIN

[fct-aor]
type=aor
max_contacts=1
qualify_frequency=60
contact=sip:fct-trunk@FCT_IP_ADRESI:5060
```

**Önemli:** 
- `ŞIFRENIZI_YAZIN` → FCT'de tanımladığınız şifre ile aynı olmalı
- `FCT_IP_ADRESI` → FCT cihazının IP'si (örn. `192.168.1.100`)

Eğer FCT **Asterisk'e kendisi kayıt oluyorsa** (FCT = SIP client), aşağıdaki registration bölümünü kullanın:

```ini
[fct-trunk]
type=registration
transport=transport-udp
outbound_auth=fct-auth
server_uri=sip:Asterisk_IP:5060
client_uri=sip:fct-trunk@Asterisk_IP
retry_interval=60
```

Bu durumda `[fct-auth]` yukarıdaki gibi kalır; `[fct-aor]` için `type=identify` ile IP tanımı:

```ini
[fct-identify]
type=identify
endpoint=fct-trunk
match=192.168.1.100
```

---

## 3. Gelen Çağrıları Yönlendirme (`extensions.conf`)

`context=from-pstn` kullandık. Bu context'i `extensions.conf` içinde tanımlayın:

```ini
; FCT veya PSTN trunk'ından gelen çağrılar
[from-pstn]
exten => _X.,1,NoOp(FCT/PSTN gelen cagri: ${CALLERID(num)} -> ${EXTEN})
 same => n,Set(CHANNEL(language)=tr)
 same => n,Answer()
 same => n,Queue(cc-support,t,,,30)
 same => n,Hangup()
```

Bu sayede FCT'den gelen tüm çağrılar `cc-support` kuyruğuna gider.

**IVR kullanmak isterseniz** (tuşla yönlendirme):

```ini
[from-pstn]
exten => _X.,1,NoOp(FCT gelen cagri)
 same => n,Set(CHANNEL(language)=tr)
 same => n,Goto(ivr-main,s,1)
```

---

## 4. Giden Çağrı (Dışarı Arama)

OpenCC'den dışarı arama için AMI_DIAL_TRUNK kullanılır. FCT trunk'ı üzerinden çıkmak için:

**.env** veya **Ayarlar** üzerinden:
- `AMI_DIAL_TRUNK=fct-trunk` (veya kullandığınız trunk adı)

`extensions.conf` içinde `from-internal` düzenlenebilir:

```ini
[from-internal]
exten => _9.,1,NoOp(Dis arama FCT uzerinden: ${EXTEN:1})
 same => n,Dial(PJSIP/${EXTEN:1}@fct-trunk,30)
 same => n,Hangup()
```

---

## 5. Örnek Tam Konfigürasyon

### `pjsip.conf` (FCT trunk eklentisi)

```ini
[fct-trunk]
type=endpoint
context=from-pstn
disallow=all
allow=ulaw
allow=alaw
auth=fct-auth
aors=fct-aor
direct_media=no

[fct-auth]
type=auth
auth_type=userpass
username=fct-trunk
password=MySecretPass123

[fct-aor]
type=aor
max_contacts=1
contact=sip:fct-trunk@192.168.1.100
```

### `extensions.conf` (from-pstn bölümü)

```ini
[from-pstn]
exten => _X.,1,NoOp(PSTN gelen: ${CALLERID(num)})
 same => n,Set(CHANNEL(language)=tr)
 same => n,Answer()
 same => n,Queue(cc-support,t,,,30)
 same => n,Hangup()
```

---

## 6. Kontrol Adımları

1. **Asterisk'i yeniden yükle:**
   ```bash
   asterisk -rx "pjsip reload"
   asterisk -rx "dialplan reload"
   ```

2. **PJSIP durumunu kontrol et:**
   ```bash
   asterisk -rx "pjsip show endpoints"
   asterisk -rx "pjsip show contacts"
   ```
   `fct-trunk` için `Contact` görünüyor olmalı.

3. **Test çağrısı:** PSTN hattından açtığınız çağrı, Asterisk üzerinden `cc-support` kuyruğuna düşmeli ve OpenCC arayüzünde ekran açılmalı (screen pop).

4. **OpenCC panelinden:** Ayarlar → Asterisk Durum sayfasından `pjsip show endpoints` çıktısını kontrol edebilirsiniz.

---

## 7. Sık Karşılaşılan Sorunlar

| Sorun | Olası Neden | Çözüm |
|------|-------------|-------|
| FCT kayıt olmuyor | Yanlış şifre, firewall | Şifre eşleşmesi, 5060 UDP açık |
| Çağrı gelmiyor | Context yanlış | `context=from-pstn` ve extensions.conf eşleşmesi |
| Tek yönlü ses | RTP / NAT | `direct_media=no`, NAT ayarları |
| Screen pop yok | Dahili eşleşmesi | `exten` veya Queue'e yönlendirme doğru mu kontrol edin |

---

## Kaynaklar

- FCT resmi dokümantasyonu (modelinize göre)
- Asterisk PJSIP: https://wiki.asterisk.org/wiki/display/AST/Configuring+res_pjsip
- OpenCC: `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS.md`
