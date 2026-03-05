# Production Deployment (HTTPS / WSS)

OpenCC'in production ortamında HTTPS ve WSS ile çalışması için yapılandırma.

## Neden HTTPS/WSS?

- **WebRTC** (ileride): Tarayıcı `http://` üzerinde mikrofon erişimine izin vermez (localhost hariç).
- **Güvenlik**: API ve WebSocket trafiği şifrelenmeli.
- **CRM webhook**: Dış sistemler genelde HTTPS bekler.

## Hızlı Başlangıç

### 1. SSL Sertifikası

**Let's Encrypt (önerilen):**
```bash
# Certbot ile sertifika al
certbot certonly --standalone -d callcenter.example.com

# Sertifikaları docker/ssl'e kopyala
mkdir -p docker/ssl
cp /etc/letsencrypt/live/callcenter.example.com/fullchain.pem docker/ssl/cert.pem
cp /etc/letsencrypt/live/callcenter.example.com/privkey.pem docker/ssl/key.pem
```

**Self-signed (test):**
```bash
mkdir -p docker/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/ssl/key.pem -out docker/ssl/cert.pem \
  -subj "/CN=localhost"
```

### 2. Production Compose

```bash
export DOMAIN=callcenter.example.com
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 3. .env Production

```bash
NODE_ENV=production
JWT_SECRET=<güçlü-rastgele-secret>
CRM_WEBHOOK_URL=https://crm.example.com/webhooks/opencc
DB_PASS=<güçlü-veritabanı-şifresi>
```

## Yapı

```
[İstemci] --HTTPS--> [Nginx:443] --HTTP--> [Frontend:3000]
                          |
                          +--HTTP--> [Backend:5000] (API, Socket.io)
```

Nginx TLS sonlandırma yapar; backend ve frontend dahili ağda HTTP kullanır.

## Sertifika Yenileme (Let's Encrypt)

```bash
certbot renew
cp /etc/letsencrypt/live/DOMAIN/fullchain.pem docker/ssl/cert.pem
cp /etc/letsencrypt/live/DOMAIN/privkey.pem docker/ssl/key.pem
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

## Güvenlik Kontrol Listesi

- [ ] **JWT_SECRET** güçlü ve rastgele (`openssl rand -hex 32`)
- [ ] **DB şifreleri** güçlü (PostgreSQL POSTGRES_PASSWORD)
- [ ] **AMI şifresi** değiştirildi (Asterisk manager.conf)
- [ ] **Firewall:** sadece 80, 443 açık (SSH opsiyonel)
- [ ] **CRM_WEBHOOK_SECRET** ayarlandı (webhook doğrulama için)
- [ ] `.env` dosyası git'e eklenmemeli (`.gitignore`)

## Ortam Değişkenleri Tablosu

| Değişken | Açıklama | Varsayılan |
|----------|----------|------------|
| DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME | PostgreSQL bağlantısı | localhost, 5432, postgres, secret, callcenter_db |
| REDIS_URL | BullMQ/Redis | redis://localhost:6379 |
| JWT_SECRET | JWT imzalama | **(gerekli, production'da değiştir)** |
| JWT_EXPIRES_IN | Token süresi | 1h |
| PORT | Backend port | 5001 |
| RECORDINGS_PATH | Ses kayıtları dizini | /recordings |
| AMI_HOST, AMI_PORT, AMI_USER, AMI_SECRET | Asterisk AMI | localhost, 5038 |
| AMI_DIAL_TRUNK, AMI_DIAL_TECH | Dış arama trunk | PJSIP |
| CRM_WEBHOOK_URL, CRM_WEBHOOK_SECRET | CRM entegrasyonu | - |
| OPENAI_API_KEY | Transkripsiyon (opsiyonel) | - |
| PUBLIC_URL | Webhook callback base URL | http://localhost:5000 |
