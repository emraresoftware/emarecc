# FCT Gateway Kontrol Listesi

Bu liste, FCT cihazınızın Advance SIP ayarlarının OpenCC/Asterisk ile uyumlu olduğunu doğrulamanızı sağlar.

## FCT Advance SIP Ayarları (Sizin Ekranınızla Karşılaştırın)

| Ayar | Önerilen Değer | Açıklama |
|------|----------------|----------|
| **SIP Listening Port Mode** | Fixed | Sabit port kullanımı |
| **Port** | 5060 | Standart SIP portu (Asterisk ile aynı) |
| **SIP INVITE Response** | SIP 180 then 183 | Uyumlu |
| **SIP Busy Code** | 503 | Uyumlu |
| **Call OUT Auth Mode** | IP | Asterisk IP tabanlı arama yapacak; şifre gerekmez |
| **Built-in SIP Proxy** | Disable | Gerekli değil |
| **NAT Keep-alive** | Enable | NAT arkasındaysanız önemli |
| **DTMF Signaling** | Outband | IVR/tuş girişleri için |
| **Outband DTMF type** | RFC 2833 | Asterisk ile uyumlu |
| **RTP Payload Type** | 101 | RFC 2833 varsayılanı |

## FCT SIP Kayıt Ayarları (Ana SIP Bölümü)

FCT'nin Asterisk'e kayıt olması için:

| Ayar | Değer |
|------|-------|
| **SIP Server / Registrar** | `192.168.1.56` (Asterisk sunucu IP) |
| **SIP Port** | 5060 |
| **SIP User / Auth User** | `fct-trunk` |
| **Password** | `fct123` |

> Asterisk `pjsip.conf` içinde `fct-auth` ile `username=fct-trunk`, `password=fct123` tanımlı. FCT'deki şifre bununla aynı olmalı.

## OpenCC Tarafı (Otomatik Yapılandırıldı)

| Bileşen | Durum |
|---------|-------|
| **pjsip.conf** | `fct-trunk`, `fct-auth`, `fct-aor` tanımlı; contact=192.168.1.100:5060 |
| **extensions.conf** | `from-pstn` → cc-support kuyruğu; `9+numara` → FCT üzerinden dış arama |
| **AMI_DIAL_TRUNK** | `fct-trunk` (seed + docker-compose) |
| **manager.conf** | admin / Emre2025** |

## Kontrol Adımları

1. **FCT IP:** FCT cihazı `192.168.1.100` üzerinde mi? (`.env` FCT_GATEWAY_IP)
2. **Ağ:** FCT ve Asterisk sunucusu (192.168.1.56) aynı ağda mı?
3. **Firewall:** 5060 UDP (SIP) ve 10000–10020 UDP (RTP) açık mı?
4. **Asterisk reload:** `docker compose exec asterisk asterisk -rx "module reload res_pjsip.so"`
5. **PJSIP durum:** `docker compose exec asterisk asterisk -rx "pjsip show endpoints"` veya `asterisk -rx "module show like pjsip"` → fct-trunk görünmeli
6. **Test:** PSTN'den arayın → OpenCC'de ekran açılmalı; 9+numara ile dış arama yapın

## Sorun Giderme

| Sorun | Kontrol |
|-------|---------|
| FCT kayıt olmuyor | Şifre fct123, SIP Server 192.168.1.56, Port 5060 |
| Gelen çağrı yok | extensions.conf [from-pstn], context=from-pstn |
| Dış arama çalışmıyor | Ayarlar → Dış Arama Trunk = fct-trunk |
| Tek yönlü ses | NAT Keep-alive Enable, direct_media=no (zaten ayarlı) |
