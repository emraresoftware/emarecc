# Kurulum ve Yapılandırma Rehberi

## Docker Network Yapılandırması (Kritik!)

Asterisk ve WebRTC kullanımı nedeniyle NAT (Network Address Translation) sorunları yaşanabilir. Bu yüzden `docker-compose.yml` dosyasında Asterisk servisi için **host network** modu önerilir.

### Örnek `docker-compose.yml` Konfigürasyonu:

```yaml
services:
  asterisk:
    image: andrius/asterisk:latest # veya kendi Dockerfile'ımız
    network_mode: host  # <--- KRİTİK AYAR: Port yönlendirme derdini bitirir.
    volumes:
      - ./asterisk_config:/etc/asterisk
      - ./recordings:/var/spool/asterisk/monitor  # <--- KRİTİK: Ses kayıtları konteyner silinse bile korunur
    cap_add:
      - SYS_PTRACE
      - NET_ADMIN

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    depends_on:
      - db
      - redis

  redis:
    image: redis:alpine
    volumes:
      - redis_data:/data  # <--- KRİTİK: NF-05 — Redis verisi kalıcı olmalı
  # ... frontend, db servisleri

volumes:
  redis_data:
```

### SSL/TLS — Lokal Geliştirme (NF-07)

WebRTC mikrofon erişimi `http://` üzerinde çalışmaz (localhost hariç). Lokal geliştirmede ses için **mkcert** ile yerel sertifika kurulması önerilir:

```bash
# mkcert kurulumu (macOS)
brew install mkcert
mkcert -install

# Sertifika oluştur
mkcert localhost 127.0.0.1
# localhost+1.pem, localhost+1-key.pem oluşur
```

Nginx veya Vite dev server'a bu sertifikalar bağlanarak HTTPS sağlanır.

### Otomatik sertifika oluşturma (proje içinde)

Projede bir yardımcı script eklendi: `scripts/generate-local-certs.sh` — bu script mkcert varsa onu kullanır, yoksa `openssl` ile self-signed sertifika üretir. Script, üretilecek sertifikaları `./asterisk_config/keys/asterisk.crt` ve `./asterisk_config/keys/asterisk.key` olarak yerleştirir (docker-compose bu klasörü `/etc/asterisk` olarak mount ediyor).

Kullanım:

```bash
# proje kökünde
chmod +x scripts/generate-local-certs.sh
VITE_SIP_DOMAIN=192.168.1.20 ./scripts/generate-local-certs.sh

# sonra asterisk'i yeniden başlatın
docker compose restart asterisk
docker compose logs -f asterisk
```

Notlar:
- Eğer mkcert kullanıyorsanız üretim tarayıcılar (lokalde) sertifikayı güvenilir olarak görecek. Eğer openssl fallback kullanıldıysa tarayıcı uyarısı alırsınız.
- Sertifikalar `asterisk_config/keys/` içinde tutulur; bu klasörü `.gitignore` ile hariç tuttuk.


## RTP Port Aralığı (NF-04 — Ölçeklenebilirlik)

50 eşzamanlı temsilci için: 50 ajan × 2 RTP bacağı = **100 port** gerekir.  
Docker tarafında (bridge modu kullanılıyorsa) **UDP 10000–10200** aralığının açılması önerilir.

```yaml
asterisk:
  ports:
    - "10000-10200:10000-10200/udp"  # RTP media
```

`network_mode: host` kullanılıyorsa port yönlendirme gerekmez.

---

## Asterisk Ayarları

WebRTC'nin çalışması için Asterisk tarafında sertifika ve WebSocket ayarlarının yapılması gerekir.

### 1. `http.conf`

```ini
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088 ; WS için
tlsenable=yes
tlsbindaddr=0.0.0.0:8089 ; WSS için (Secure)

```

### 2. `pjsip.conf` (WebRTC Endpoint Örneği)

WebRTC kullanan tarayıcılar için özel `transport` ve `aor` tanımları yapılmalıdır. Şifreleme (DTLS-SRTP) zorunludur.

**Codec:** Tarayıcılar genelde **Opus** veya **G.711 (alaw/ulaw)** kullanır. `allow` ve `disallow` direktifleriyle bu codec'lere izin verin.

## Çevre Değişkenleri

### Backend (.env)

```bash
# App
NODE_ENV=development
PORT=5000

# Database
DB_HOST=localhost
DB_USER=postgres
DB_PASS=secret
DB_NAME=callcenter_db

# Asterisk AMI Credentials
AMI_HOST=localhost
AMI_PORT=5038
AMI_USER=admin
AMI_SECRET=mysecretpassword
```

### Frontend (frontend/.env veya docker-compose environment)

Lokal Vite dev: `vite.config.js` proxy kullanır (backend 5001 varsayılan). Ek ayar gerekmez.

Docker veya ayrı backend kullanımında:

```bash
# frontend/.env
VITE_API_URL=http://localhost:5001
VITE_WS_URL=ws://localhost:5001
```

`docker-compose.yml` frontend build sırasında bu değerleri alır. Backend port 5001 ise aynen kullanın.
