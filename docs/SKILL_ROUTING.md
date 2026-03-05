# Yetenek Bazlı Yönlendirme (Skill-Based Routing)

IVR'da müşteri seçimine göre (örn. "İngilizce için 9'a basın") çağrıyı uygun yetenekteki hazır ajana yönlendirme.

## API

### GET /api/v1/skills/route?skill=ingilizce

Yeteneğe göre en uygun hazır ajanın extension'ını döner.

**Query:**
- `skill` (zorunlu) — Yetenek adı (küçük harf, boşluksuz önerilir: ingilizce, teknik, satis)
- `token` (opsiyonel) — `SKILL_ROUTE_TOKEN` env ile eşleşmeli (production'da önerilir)

**Response (200):**
```json
{ "extension": "1001" }
```

**Response (404):** Uygun hazır ajan yok

## Asterisk Entegrasyonu

### 1. IVR'dan skill parametresi geçirme

Dialplan'da IVR seçimine göre variable atayın:

```
[ivr-main]
; 1 = Destek, 2 = Satış, 9 = İngilizce
exten => 1,1,Set(SKILL=destek)
exten => 2,1,Set(SKILL=satis)
exten => 9,1,Set(SKILL=ingilizce)
; ... sonra skill routing'e yönlendir
```

### 2. AGI veya curl ile sorgu

Asterisk dialplan'dan `curl` ile API'yi çağırın:

```
[skill-route]
exten => s,1,Set(API_URL=${OPENCC_API_URL:-http://localhost:5001/api/v1})
same => n,Set(TOKEN=${SKILL_ROUTE_TOKEN:-})
same => n,Set(CURL_CMD=curl -s "${API_URL}/skills/route?skill=${SKILL}&token=${TOKEN}")
same => n,Set(EXTEN=${SHELL(${CURL_CMD})})
; EXTEN JSON içinde "extension":"1001" - parse gerekir
```

`jq` kullanarak:

```
same => n,Set(RESULT=${SHELL(curl -s "${API_URL}/skills/route?skill=${SKILL}&token=${TOKEN}")})
same => n,Set(EXTEN=${FILTER(*,"",${RESULT})})
```

Daha basit: Node.js AGI script yazılabilir — API'yi çağırıp `extension` döner, Asterisk'e SET VARIABLE ile geçirilir.

### 3. Yönlendirme

```
same => n,GotoIf($["${EXTEN}" = ""]?no-agent:dial-agent)
same => n(dial-agent),Dial(PJSIP/${EXTEN},30)
same => n,Hangup()
same => n(no-agent),Playback(sorry-no-agents)
same => n,Hangup()
```

## Admin: Yetenek Atama

Kullanıcılar → Agent satırında **Yıldız** ikonuna tıklayın → Yetenek ekleyin (örn. `ingilizce`, seviye `8`).

Seviye 1–10: Yüksek seviye öncelikli yönlendirilir.
