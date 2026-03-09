# 📞 Emare CC — Tam Kurulum ve Yapılandırma Rehberi

> **Son Güncelleme:** 8 Mart 2026 (v2)  
> **Amaç:** Şu ana kadar yapılan tüm ayarların dokümantasyonu. Sistem sıfırdan kurulursa veya bir sorun olursa bu rehber adım adım takip edilebilir.

---

## 📋 İçindekiler

1. [Sistem Mimarisi](#1-sistem-mimarisi)
2. [Ağ Bilgileri](#2-ağ-bilgileri)
3. [Docker Servisleri](#3-docker-servisleri)
4. [Asterisk Yapılandırması](#4-asterisk-yapılandırması)
5. [GoIP16 GSM Gateway Yapılandırması](#5-goip16-gsm-gateway-yapılandırması)
6. [Nginx Reverse Proxy](#6-nginx-reverse-proxy)
7. [WebRTC / SIP.js Yapılandırması](#7-webrtc--sipjs-yapılandırması)
8. [Gelen Arama Akışı](#8-gelen-arama-akışı)
9. [Giden Arama Akışı](#9-giden-arama-akışı)
10. [Sorun Giderme](#10-sorun-giderme)
11. [Kritik Dosyalar ve Yedekleme](#11-kritik-dosyalar-ve-yedekleme)
12. [Bilinen Sorunlar](#12-bilinen-sorunlar)

---

## 1. Sistem Mimarisi

```
                    ┌─────────────────────────────────────────┐
                    │           Docker Host (Mac)              │
                    │           192.168.1.64                    │
                    │                                          │
   GSM Şebeke      │  ┌──────────┐    ┌─────────────┐        │    Tarayıcı
   (Vodafone TR)   │  │ Asterisk │    │   Backend   │        │   (WebRTC)
        │          │  │ :5060 UDP│←──→│   :5001     │        │      │
        │          │  │ :8088 WS │    │  (Node.js)  │        │      │
        ▼          │  └────┬─────┘    └──────┬──────┘        │      │
  ┌──────────┐     │       │                 │               │      │
  │ GoIP16   │◄────┼───────┘           ┌─────┴─────┐        │      │
  │ GSM GW   │ SIP │                   │ PostgreSQL│        │      │
  │ .1.100   │─────┼──────────────┐    │   :5433   │        │      │
  └──────────┘     │              │    └───────────┘        │      │
                    │              │    ┌───────────┐        │      │
                    │              │    │   Redis   │        │      │
                    │              │    │   :6380   │        │      │
                    │              │    └───────────┘        │      │
                    │         ┌────┴──────────┐              │      │
                    │         │    Nginx      │◄─────────────┼──────┘
                    │         │  :3783 (HTTPS)│              │
                    │         │  :3000 (HTTP) │              │
                    │         └───────────────┘              │
                    └─────────────────────────────────────────┘
```

---

## 2. Ağ Bilgileri

| Bileşen | IP / Port | Açıklama |
|---------|-----------|----------|
| **Docker Host (Mac)** | `192.168.1.64` | Asterisk, Backend, Nginx çalıştırır |
| **GoIP16 GSM Gateway** | `192.168.1.100` | 16 portlu GSM gateway, SIM Line 1 aktif |
| **Docker NAT IP** | `149.34.200.122` | GoIP → Asterisk SIP trafiği bu IP'den gelir |
| **Asterisk SIP** | `5060/UDP` | Docker port: 5060:5060/udp |
| **Asterisk WSS** | `8088 (WS) / 8089 (WSS)` | WebSocket (WebRTC için) |
| **Asterisk AMI** | `5038` | Manager Interface |
| **Backend API** | `5001 → 5000` | Docker port mapping |
| **Nginx HTTPS** | `3783 → 443` | Frontend + API proxy |
| **Nginx HTTP** | `3000 → 80` | HTTPS'ye yönlendirir |
| **PostgreSQL** | `5433 → 5432` | Veritabanı |
| **Redis** | `6380 → 6379` | Cache / Session |
| **RTP Aralığı** | `10000-10020/UDP` | Ses paketleri |

---

## 3. Docker Servisleri

### Başlatma
```bash
cd /Users/emre/Desktop/Emare/emarecc
docker compose up -d
```

### Servisler
| Servis | Image | Bağımlılıklar |
|--------|-------|---------------|
| `db` | postgres:16-alpine | — |
| `redis` | redis:alpine | — |
| `asterisk` | andrius/asterisk:latest | db |
| `backend` | ./backend (Dockerfile) | db, redis, asterisk |
| `worker` | ./backend | db, redis |
| `frontend` | ./frontend (Dockerfile) | backend |
| `web` (nginx) | nginx:alpine | frontend, backend |

### Önemli Volume Mount'lar
```yaml
asterisk:
  volumes:
    - ./asterisk_config:/etc/asterisk          # TÜM Asterisk config dosyaları
    - ./recordings:/var/spool/asterisk/monitor # Arama kayıtları

web (nginx):
  volumes:
    - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    - ./frontend/dist:/usr/share/nginx/html:ro      # Frontend build çıktısı
    - ./asterisk_config/keys:/etc/ssl/certs:ro       # SSL sertifikaları
```

### Backend Ortam Değişkenleri
```env
NODE_ENV=development
PORT=5000
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASS=secret
DB_NAME=callcenter_db
REDIS_URL=redis://redis:6379
AMI_HOST=asterisk
AMI_PORT=5038
AMI_USER=admin
AMI_SECRET=Emre2025**
AMI_DIAL_TRUNK=fct-trunk
AMI_DIAL_TECH=PJSIP
AMI_ORIGINATE_TIMEOUT_MS=15000
JWT_SECRET=opencc-jwt-secret-change-in-production
GOIP_HOST=192.168.1.100
GOIP_USER=admin
GOIP_PASS=admin
```

---

## 4. Asterisk Yapılandırması

### 4.1 PJSIP — `asterisk_config/pjsip.conf`

#### Transport'lar
```ini
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060
external_media_address=192.168.1.64       # ← Host IP (Docker dışı)
external_signaling_address=192.168.1.64   # ← Host IP (Docker dışı)
local_net=172.19.0.0/16                   # Docker network
local_net=127.0.0.0/8

[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0

[transport-ws]
type=transport
protocol=ws
bind=0.0.0.0
```

> ⚠️ **KRİTİK:** `external_media_address` ve `external_signaling_address` her zaman Docker HOST'un LAN IP'si olmalı (şu an `192.168.1.64`). Bu değişirse GoIP16 ve WebRTC bağlantısı kopar.

#### WebRTC Endpoint Şablonu
```ini
[webrtc-endpoint](!)
type=endpoint
context=from-internal
disallow=all
allow=opus,ulaw,alaw
transport=transport-wss
webrtc=yes
dtls_auto_generate_cert=yes
dtls_verify=no
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
ice_support=yes
media_encryption=dtls
media_use_received_transport=yes
trust_id_inbound=yes
send_rpid=yes
```

#### WebRTC Dahili Endpointlar (1000–1035)
```ini
# Her dahili için 3 bölüm:
[1000](webrtc-endpoint)
auth=auth-1000
aors=1000

[auth-1000]
type=auth
auth_type=userpass
username=1000
password=webrtc123    # ← TÜM dahililer aynı şifre

[1000](webrtc-aor)
# webrtc-aor şablonu: max_contacts=5, remove_existing=yes, qualify_frequency=30
```

> **Not:** 1000–1035 arası toplam 36 dahili tanımlı. Şifre hepsi için `webrtc123`.

#### FCT Trunk (GoIP16)
```ini
[fct-trunk]
type=endpoint
context=from-pstn          # ← Gelen aramalar bu context'e düşer
disallow=all
allow=ulaw
allow=alaw
transport=transport-udp
aors=fct-trunk
auth=fct-auth
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes

[fct-identify]
type=identify
endpoint=fct-trunk
match=192.168.1.100        # ← GoIP16 LAN IP'si
match=149.34.200.122       # ← Docker NAT IP (GoIP trafiği bu IP'den gelir)

[fct-auth]
type=auth
auth_type=userpass
username=fct-trunk
password=fct123

[fct-trunk]    # AOR
type=aor
max_contacts=5
remove_existing=yes
qualify_frequency=60
contact=sip:192.168.1.100:5060    # ← GoIP16 IP
```

> ⚠️ **KRİTİK:** AOR adı (`fct-trunk`) endpoint adıyla AYNI OLMALI. Eskiden `fct-aor` idi, düzeltildi.  
> ⚠️ **KRİTİK:** `fct-identify` → `match` satırında hem `192.168.1.100` hem `149.34.200.122` olmalı. Docker NAT sebebiyle GoIP gelen paketleri NAT IP'sinden gelir.

### 4.2 Dialplan — `asterisk_config/extensions.conf`

#### Gelen Arama (PSTN → Kuyruk)
```ini
[from-pstn]
exten => _X.,1,NoOp(FCT/PSTN gelen: ${CALLERID(num)})
 same => n,Set(CHANNEL(language)=tr)
 same => n,Queue(cc-support,tr,,,60)
 same => n,Hangup()
```

> ⚠️ **KRİTİK:** `[from-pstn]` context'inde `Answer()` YOKTUR. Agent açana kadar arayan çalma sesi duyar. Answer() eklerseniz kuyruk davranışı bozulur.

#### Giden Arama (Dahili → PSTN)
```ini
[from-internal]
; 9 + numara ile dış arama
exten => _9.,1,NoOp(Dis arama: ${EXTEN:1})
 same => n,Set(DST=${EXTEN:1})
 same => n,ExecIf($[${LEN(${DST})}=10]?Set(DST=0${DST}))
 same => n,ExecIf($[${LEN(${DST})}=12 & "${DST:0:2}"="90"]?Set(DST=0${DST:2}))
 same => n,NoOp(FCT Trunk GW arama hedef: ${DST})
 same => n,Dial(PJSIP/${DST}@fct-trunk,30)
 same => n,Hangup()
```

> **Not:** GoIP16 Trunk Gateway Mode'da prefix KULLANMAZ. Numara direkt gönderilir.  
> **Numara formatı:** `905XXXXXXXXX` → `0 5XX XXX XX XX` formatına çevrilir.

#### Dahiliden Dahiliye
```ini
exten => _1XXX,1,NoOp(Dahili ${EXTEN} aranıyor)
 same => n,Dial(PJSIP/${EXTEN},30)
 same => n,Hangup()
```

#### Geri Arama (Callback Routing)
```ini
[direct-to-agent]
exten => _X.,1,NoOp(Direct to agent ${EXTEN})
 same => n,Set(CHANNEL(language)=tr)
 same => n,Dial(PJSIP/${EXTEN},30)
 same => n,Hangup()
```

### 4.3 Kuyruklar — `asterisk_config/queues.conf`

```ini
[cc-support]
strategy=ringall
timeout=30
retry=5
wrapuptime=10
maxlen=0
ringinuse=no
memberdelay=1
reportholdtime=yes

member => PJSIP/1000
member => PJSIP/1001
member => PJSIP/1002
member => PJSIP/1003
member => PJSIP/1004
member => PJSIP/1005
member => PJSIP/1006
member => PJSIP/1007
member => PJSIP/1008
member => PJSIP/1009
member => PJSIP/1010
```

> **Not:** `strategy=ringall` → tüm online dahililer aynı anda çalar. Sadece "registered" (WebRTC bağlı) olanlar çalar.

### 4.4 AMI — `asterisk_config/manager.conf`

```ini
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0

[admin]
secret = Emre2025**
permit = 0.0.0.0/0.0
read = system,call,log,verbose,agent,user,config,dtmf,reporting,cdr,dialplan
write = system,call,agent,user,config,command,reporting,originate
```

### 4.5 HTTP/WebSocket — `asterisk_config/http.conf`

```ini
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlscertfile=/etc/asterisk/keys/asterisk.crt
tlsprivatekey=/etc/asterisk/keys/asterisk.key
```

### 4.6 Modüller — `asterisk_config/modules.conf`

```ini
[modules]
autoload=yes

load => res_http_websocket.so         # WebSocket desteği
load => res_pjsip_transport_websocket.so  # PJSIP WSS transport
load => codec_opus.so                 # Opus codec (WebRTC)
```

---

## 5. GoIP16 GSM Gateway Yapılandırması

### 5.1 Cihaz Bilgileri
| Alan | Değer |
|------|-------|
| **Model** | GoIP16 (16-port GSM Gateway) |
| **Firmware** | GST-1.01-68 |
| **Module Firmware** | G610_V0C.58.0D_T1B |
| **LAN IP** | 192.168.1.100 |
| **Web Panel** | http://192.168.1.100 (admin / admin) |
| **SN** | GOIP16E1BTR13083591 |
| **Çalışma Modu** | Trunk Gateway Mode |

### 5.2 SIM Durumu
| Line | Durum | Operatör | Not |
|------|-------|----------|-----|
| **Line 1** | ✅ Aktif | Vodafone TR | IMSI: 286027349289894 |
| **Line 2–16** | ❌ Boş | — | Modüller kapalı |

### 5.3 GoIP16 Web Panel Ayarları (DOKUNMAYIN!)

#### Config Sayfası: **Calling** (`/default/en_US/config.html?type=calling`)
| Ayar | Değer | Açıklama |
|------|-------|----------|
| **SIP Config Mode** | Trunk Gateway | 16 port tek SIP hesabı ile çalışır |
| **SIP Registrar** | `192.168.1.64` | Asterisk host IP |
| **SIP Server Port** | `5060` | |
| **Authentication ID** | `fct-trunk` | pjsip.conf'taki endpoint adı |
| **Authentication Password** | `fct123` | pjsip.conf'taki auth şifresi |
| **SIP Phone Number** | `fct-trunk` | |
| **SIP Proxy** | (boş) | |
| **Display Name** | (boş) | |

> ⚠️ **KRİTİK:** `SIP Registrar` = `192.168.1.64` (Docker host IP). Eski değer `78.47.33.186` idi. Bu KESINLIKLE host IP olmalı.

#### Config Sayfası: **Call In** (`/default/en_US/config.html?type=call_in_auth`)
| Ayar | Değer | Açıklama |
|------|-------|----------|
| **line1_fw_to_voip** | `on` | GSM gelen arama → SIP yönlendirme etkin |
| **line1_fw_num_to_voip** | `1000` | Gelen aramalar dahili 1000'e yönlendirilir |

> ⚠️ **KRİTİK:** `line1_fw_num_to_voip` BOŞSA gelen aramalar Asterisk'e ulaşmaz! Mutlaka bir dahili numarası yazılmalı. Bu numara `[from-pstn]` context'inde `Queue(cc-support)` ile kuyruğa yönlendirilir.

#### Config Sayfası: **Advance SIP** (`/default/en_US/config.html?type=advance_calling`)
| Ayar | Önerilen Değer |
|------|---------------|
| SIP Listening Port Mode | Fixed |
| Port | 5060 |
| SIP INVITE Response | SIP 180 then 183 |
| Call OUT Auth Mode | IP |
| Built-in SIP Proxy | Disable |
| NAT Keep-alive | Enable |
| DTMF Signaling | Outband |
| Outband DTMF Type | RFC 2833 |
| RTP Payload Type | 101 |

#### Config Sayfası: **Media** (`/default/en_US/config.html?type=media`)
| Ayar | Değer | Açıklama |
|------|-------|----------|
| Default Codec | PCMU (ulaw) | Asterisk ile uyumlu |
| 2nd Codec | PCMA (alaw) | Yedek codec |
| NAT Traversal | None | Aynı LAN'da oldukları için |

#### Config Sayfası: **Advance VoIP** (`/default/en_US/config.html?type=ata_in_setting`)
| Ayar | Olması Gereken | Mevcut Durum | Not |
|------|---------------|-------------|-----|
| SIP Relay Server | (boş) | ⚠️ 78.47.33.186 olabilir | Temizlenmeli |
| RTP Relay Server | (boş) | ⚠️ 78.47.33.186 olabilir | Temizlenmeli |

> ⚠️ **TEMİZLİK GEREKLİ:** `sip_relay_server` ve `rtp_relay_server` eski IP `78.47.33.186` içerebilir. NAT Traversal=None olduğu için aktif sorun yaratmıyor ama temizlenmeli. GoIP web panelinden **Advance VoIP** sayfasına gidip bu alanları boşaltın.

#### Config Sayfası: **Preferences** (`/default/en_US/config.html?type=preference`)
| Ayar | Olması Gereken | Mevcut Durum | Not |
|------|---------------|-------------|------|
| SMB Server | (boş) | ⚠️ 78.47.33.186 olabilir | Temizlenmeli |

### 5.4 GoIP16 — Dokunulmaması Gereken Ayarlar

Bu ayarların HİÇBİRİNİ değiştirmeyin (sıfırdan ayarlanmadıkça):

1. ❌ **SIM Config Mode** → Trunk Gateway (değiştirirseniz tüm SIP kayıtları bozulur)
2. ❌ **SIP Registrar** → 192.168.1.64 (değiştirirseniz trunk registration düşer)
3. ❌ **Authentication ID/Password** → fct-trunk / fct123 (değiştirirseniz Asterisk redder)
4. ❌ **line1_fw_to_voip** → on (kapatırsanız gelen aramalar SIP'e gelmez)
5. ❌ **line1_fw_num_to_voip** → 1000 (silseniz gelen aramalar yönlendirilmez)
6. ❌ **Firmware** → Güncellemeyin (uyumluluk bozulabilir)

---

## 6. Nginx Reverse Proxy

### Dosya: `docker/nginx/default.conf`

```nginx
# HTTP → HTTPS yönlendirme
server {
    listen 80;
    server_name _;
    return 301 https://$host:3783$request_uri;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/ssl/certs/asterisk.crt;
    ssl_certificate_key /etc/ssl/certs/asterisk.key;

    root /usr/share/nginx/html;    # → frontend/dist
    index index.html;

    # Frontend (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Socket.IO WebSocket
    location /socket.io/ {
        proxy_pass http://backend:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Asterisk SIP WebSocket (WebRTC)
    location /ws {
        proxy_pass http://asterisk:8088/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

> **Not:** WebRTC SIP trafiği tarayıcıdan `wss://<host>:3783/ws` üzerinden gelir → Nginx TLS terminate eder → Asterisk'e düz WS (8088) olarak iletir.

---

## 7. WebRTC / SIP.js Yapılandırması

### Frontend: `frontend/src/context/SipContext.jsx`

```javascript
// Otomatik belirlenen değerler:
const WS_URL = `wss://${window.location.host}/ws`;    // → wss://192.168.1.64:3783/ws
const SIP_DOMAIN = window.location.hostname;            // → 192.168.1.64
const SIP_SECRET = 'webrtc123';                         // → pjsip.conf auth şifresi

// SimpleUser URI: sip:1000@192.168.1.64
// WebSocket Server: wss://192.168.1.64:3783/ws
```

### SIP.js SimpleUser Ayarları
```javascript
{
  aor: `sip:${ext}@${SIP_DOMAIN}`,
  media: {
    constraints: { audio: true, video: false },
    remote: { audio: audioElement }
  },
  userAgentOptions: {
    authorizationUsername: ext,      // 1000
    authorizationPassword: SIP_SECRET, // webrtc123
    uri: UserAgent.makeURI(`sip:${ext}@${SIP_DOMAIN}`),
    transportOptions: { server: WS_URL },
    sessionDescriptionHandlerFactoryOptions: {
      peerConnectionConfiguration: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    }
  }
}
```

### Delegate Callbacks
| Callback | State | Açıklama |
|----------|-------|----------|
| `onCallReceived` | → `incoming` | Gelen arama algılandı, caller numarası çıkarılır |
| `onCallAnswered` | → `connected` | Arama cevaplanıp köprülendi |
| `onCallHangup` | → `registered` | Arama sonlandı |
| `onCallHold` | — | Bekletme durumu |

### Gelen Arama Modalı: `frontend/src/components/SipIncomingModal.jsx`
- **Tetikleme:** `sip.enabled && state === 'incoming'`
- **Gösterim:** Yeşil kenarlıklı dialog, nabız animasyonu, caller numarası
- **Butonlar:** Cevapla (yeşil) / Reddet (kırmızı)
- **Audio:** `/ringtone.wav` loop olarak çalar (fallback: Web Audio API oscillator 800Hz)

---

## 8. Gelen Arama Akışı (End-to-End)

```
1. Dış numara → GSM şebekesi → GoIP16 SIM Line 1
2. GoIP16: line1_fw_to_voip=on, fw_num=1000
   → SIP INVITE sip:1000@192.168.1.64
3. Asterisk: fct-identify → fct-trunk endpoint → context=from-pstn
4. Dialplan [from-pstn]:
   → NoOp(FCT/PSTN gelen: ${CALLERID(num)})
   → Set(language=tr)
   → Queue(cc-support,tr,,,60)
5. Queue cc-support: strategy=ringall
   → Tüm online PJSIP/1XXX endpointlerine INVITE gönderir
6. WebRTC tarayıcı: SIP.js SimpleUser INVITE alır
   → onCallReceived tetiklenir
   → state='incoming', caller numarası gösterilir
   → SipIncomingModal açılır
   → Çalma sesi + browser bildirimi
7. Agent "Cevapla" tıklar
   → 200 OK gönderilir → media bridge kurulur
   → state='connected'
8. Görüşme biter → BYE → state='registered'
```

---

## 9. Giden Arama Akışı

### WebRTC Doğrudan Arama (Güncel Yöntem)
```
1. Agent: Müşteri sayfasında veya softphone'da "Ara" tıklar
2. Frontend: POST /api/calls/initiate { ..., webrtc_direct: true }
   → Backend: DB'ye çağrı kaydı yazar (status: 'ringing'), AMI Originate YAPMAZ
3. Frontend: SIP.js ile doğrudan INVITE gönderir:
   sip.call('9' + '05XXXXXXXXX')  →  INVITE sip:905XXXXXXXXX@domain
4. Asterisk: [from-internal] _9. pattern yakalar
   → DST = ${EXTEN:1} = 05XXXXXXXXX
   → Dial(PJSIP/05XXXXXXXXX@fct-trunk,30)
5. GoIP16 → GSM → Müşteri telefonu çalar
6. Müşteri açar → Bridge (çift yönlü ses)
```

> **Neden AMI Originate kullanılmıyor?**  
> AMI Originate yaklaşımı önce ajanın kendi telefonunu çalar, ajan cevapladıktan sonra dış numara aranırdı.
> Bu, WebRTC'de sorunlara yol açıyordu:
> - 15s JS-level timeout (AMI senkron çalışır, yanıt geç gelir)
> - Agent'ın kendi telefonunu cevaplaması gerekir (kötü UX)
> - qualify_frequency=0 iken stale contact → INVITE kaybolur
>
> Doğrudan SIP INVITE ile tarayıcı Asterisk'e kendisi INVITE gönderir,
> Asterisk from-internal dialplan'dan fct-trunk üzerinden çıkar. Basit ve güvenilir.

### Dahili Arama
```
Agent: Softphone'da 1001 yazar → Ara
SIP.js: INVITE sip:1001@domain
Asterisk: [from-internal] _1XXX pattern → Dial(PJSIP/1001,30)
```

### Fallback: AMI Originate (WebRTC hazır değilse)
```
WebRTC bağlı değilse frontend AMI Originate fallback'e düşer:
1. POST /api/calls/initiate { webrtc_direct: UNDEFINED }
2. Backend: AMI Originate → PJSIP/1000 → Agent cevaplar → Dış arama
   (Timeout: 15s JS + 60s Asterisk)
```

---

## 10. Sorun Giderme

### 10.1 GoIP16 Trunk Registered mı?
```bash
docker compose exec asterisk asterisk -rx "pjsip show endpoints" | grep fct
# Beklenen: fct-trunk ... Avail ... (Contact: sip:192.168.1.100:5060)

docker compose exec asterisk asterisk -rx "pjsip show contacts" | grep fct
# Beklenen: fct-trunk/sip:192.168.1.100:5060 ... Avail ... RTT: ~10ms
```

### 10.2 WebRTC Endpoint Kayıtlı mı?
```bash
docker compose exec asterisk asterisk -rx "pjsip show endpoints" | grep 1000
# Beklenen: 1000 ... Avail ... (Contact: sip:... transport=wss)
```

### 10.3 Gelen Arama Asterisk'e Ulaşıyor mu?
```bash
# Asterisk SIP trace
docker compose exec asterisk asterisk -rx "pjsip set logger on"
docker compose exec asterisk asterisk -rvvvvv
# SIM numarasını arayın ve INVITE loglarını izleyin
```

### 10.4 Queue'da Kim Online?
```bash
docker compose exec asterisk asterisk -rx "queue show cc-support"
# Her member'ın (Not in use) veya (Unavailable) durumunu gösterir
```

### 10.5 Docker Logları
```bash
# Asterisk
docker compose logs --tail=100 -f asterisk

# Backend
docker compose logs --tail=100 -f backend

# Tüm servisler
docker compose logs --tail=50
```

### 10.6 Tarayıcı Konsolu
```
F12 → Console sekmesi

[SIP] 📞 Gelen arama algılandı — arayan: 05XXXXXXXXX
[SipIncomingModal] state: incoming enabled: true caller: 05XXXXXXXXX open: true
```

### 10.7 GoIP16 Web Panel Erişim
```
URL: http://192.168.1.100
Kullanıcı: admin
Şifre: admin
```

### 10.8 Config Reload (Asterisk Restart Gerekmeden)
```bash
# PJSIP reload
docker compose exec asterisk asterisk -rx "module reload res_pjsip.so"

# Dialplan reload
docker compose exec asterisk asterisk -rx "dialplan reload"

# Queue reload
docker compose exec asterisk asterisk -rx "module reload app_queue.so"
```

### 10.9 Frontend Rebuild ve Deploy
```bash
cd frontend
npm run build
cd ..
cp -r frontend/dist/* frontend_dist/
docker compose restart web
```

---

## 11. Kritik Dosyalar ve Yedekleme

### Değiştirdiğimiz Dosyalar (YEDEKLEYİN!)
| Dosya | Açıklama | Son Değişiklik |
|-------|----------|----------------|
| `asterisk_config/pjsip.conf` | Trunk, endpoint, transport tanımları | 8 Mart 2026 |
| `asterisk_config/extensions.conf` | Dialplan (gelen/giden arama kuralları) | 7 Mart 2026 |
| `asterisk_config/queues.conf` | Kuyruk tanımları ve üyeler | 5 Mart 2026 |
| `asterisk_config/manager.conf` | AMI erişim bilgileri | 5 Mart 2026 |
| `asterisk_config/http.conf` | WebSocket/TLS ayarları | 5 Mart 2026 |
| `asterisk_config/modules.conf` | WebRTC modülleri | 5 Mart 2026 |
| `docker-compose.yml` | Docker servis tanımları | 6 Mart 2026 |
| `docker/nginx/default.conf` | Nginx proxy kuralları | 6 Mart 2026 |
| `frontend/src/context/SipContext.jsx` | WebRTC SIP.js bağlantı mantığı | 8 Mart 2026 |
| `frontend/src/components/SipIncomingModal.jsx` | Gelen arama modal UI | 8 Mart 2026 |
| `frontend/src/components/SoftphoneWidget.jsx` | Softphone widget (direct SIP call) | 8 Mart 2026 |
| `frontend/src/components/QuickDialDialog.jsx` | Hızlı arama dialog (direct SIP call) | 8 Mart 2026 |
| `frontend/src/pages/CustomerDetail.jsx` | Müşteri detay - arama butonu | 8 Mart 2026 |
| `frontend/src/pages/PreviewDialer.jsx` | Preview dialer - arama butonu | 8 Mart 2026 |
| `backend/src/routes/calls.ts` | Çağrı API (webrtc_direct flag) | 8 Mart 2026 |
| `backend/src/services/ami.ts` | AMI servisi (callback redirect devre dışı) | 8 Mart 2026 |
| `backend/src/middleware/validate.ts` | Zod şemaları (webrtc_direct) | 8 Mart 2026 |

### Yedekleme Komutu
```bash
# Tüm kritik dosyaları tarih damgalı arşive al
cd /Users/emre/Desktop/Emare/emarecc
tar czf ../emarecc_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  asterisk_config/ \
  docker-compose.yml \
  docker/nginx/default.conf \
  frontend/src/context/SipContext.jsx \
  frontend/src/components/SipIncomingModal.jsx \
  frontend/src/components/SoftphoneWidget.jsx \
  docs/
```

---

## 12. Bilinen Sorunlar ve Çözülen Sorunlar

### ✅ Çözülen Sorunlar (8 Mart 2026)

#### 1. Gelen Aramada Çift Modal + Ses Yok
**Sorun:** Backend'deki AMI Redirect (`direct-to-agent` context) Queue bağlandıktan sonra tetikleniyordu → BYE + yeni INVITE → çift modal.  
**Çözüm:** `ami.ts` içindeki `handleIncomingCall` redirect bloğu devre dışı bırakıldı.

#### 2. Gelen Aramada Cevapla Butonu Çalışmıyor
**Sorun:** SIP.js SimpleUser config'de `media.constraints` tanımlı değildi → `answer()` başarısız oluyordu.  
**Çözüm:** `SipContext.jsx`'e `media: { constraints: { audio: true, video: false } }` eklendi.

#### 3. Zil Sesi Çalmıyor
**Sorun:** Ringtone WAV dosyası `.mp3` uzantısıyla kaydedilmişti + autoplay policy engellemesi.  
**Çözüm:** Dosya `.wav` olarak düzeltildi + AudioContext unlock mekanizması + Web Audio API oscillator fallback eklendi.

#### 4. Dış Arama AMI Originate Timeout
**Sorun:** AMI Originate senkron çalışıyordu (agent'ın kendi telefonunu cevaplaması gerekiyordu). 15s JS timeout, qualify_frequency=0 (stale contact).  
**Çözüm:**
- Dış aramalar artık WebRTC'den doğrudan SIP INVITE ile yapılıyor (AMI Originate bypass)
- `webrtc_direct: true` flag'i ile backend sadece DB kaydı oluşturuyor
- `pjsip.conf`: `qualify_frequency=30` ile WebRTC endpoint'leri 30s'de bir kontrol ediliyor
- Frontend 4 bileşen güncellendi: SoftphoneWidget, QuickDialDialog, CustomerDetail, PreviewDialer

### Temizlenmesi Gereken GoIP16 Ayarları
GoIP16 web panelinden aşağıdaki eski IP'leri temizleyin:

| Sayfa | Alan | Mevcut (eski) | Olması Gereken |
|-------|------|---------------|----------------|
| Advance VoIP | sip_relay_server | 78.47.33.186 | (boş) |
| Advance VoIP | rtp_relay_server | 78.47.33.186 | (boş) |
| Preferences | smb_svr | 78.47.33.186 | (boş) |

> Bu ayarlar NAT Traversal=None olduğu için şu an aktif sorun yaratmıyor ama temizlenmeli.

### IP Değişikliği Durumunda Yapılacaklar
Docker host IP'si değişirse (şu an `192.168.1.64`):

1. `pjsip.conf` → `external_media_address` ve `external_signaling_address` güncelle
2. GoIP16 web panel → **Calling** sayfası → `SIP Registrar` güncelle
3. `fct-identify` → `match` listesine yeni NAT IP ekle (gerekirse)
4. Asterisk reload: `docker compose exec asterisk asterisk -rx "module reload res_pjsip.so"`

### Docker NAT IP Değişikliği
Docker NAT IP değişirse (şu an `149.34.200.122`):

1. `pjsip.conf` → `[fct-identify]` → `match=YENİ_IP` ekle
2. Asterisk reload

### Frontend Bozulursa
```bash
cd frontend && npm run build && cd .. && cp -r frontend/dist/* frontend_dist/ && docker compose restart web
```

---

## Giriş Bilgileri Özeti

| Sistem | Kullanıcı | Şifre | Not |
|--------|-----------|-------|-----|
| **OpenCC Web** | admin | admin123 | Admin rolü, dahili 1000 |
| **OpenCC Web** | agent1 | admin123 | Agent rolü, dahili 1001 |
| **GoIP16 Panel** | admin | admin | http://192.168.1.100 |
| **Asterisk AMI** | admin | Emre2025** | Port 5038 |
| **PostgreSQL** | postgres | secret | Port 5433 (host) |
| **WebRTC SIP** | 1000–1035 | webrtc123 | Tüm dahililer aynı şifre |
| **FCT Trunk** | fct-trunk | fct123 | GoIP16 ↔ Asterisk |

---

> **Bu rehber, 5-8 Mart 2026 arasında yapılan tüm kurulum ve yapılandırma çalışmalarını kapsar.**  
> **v2 güncelleme (8 Mart 2026):** Giden arama WebRTC doğrudan SIP'e geçirildi, gelen arama sorunları çözüldü, qualify eklendi.  
> **Herhangi bir ayar değişmeden önce bu dokümanı referans alın.**
