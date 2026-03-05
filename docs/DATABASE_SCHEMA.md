# Veritabanı Şeması

Proje PostgreSQL kullanmaktadır. Ana tablolar ve ilişkileri aşağıdadır.

## 1. Users (Sistem Kullanıcıları / Temsilciler)

Çağrı merkezindeki operatörler ve yöneticiler.

| Column | Type | Description |
| --- | --- | --- |
| id | UUID | Primary Key |
| username | VARCHAR | Giriş adı |
| extension | VARCHAR | Asterisk Dahili Numarası (Örn: 1001) |
| role | ENUM | 'admin', 'agent', 'supervisor' |
| status | VARCHAR | 'ready', 'paused', 'offline' |

## 2. Customers (Müşteriler)

Arama geldiğinde tanınacak kişiler.

| Column | Type | Description |
| --- | --- | --- |
| id | UUID | Primary Key |
| phone_number | VARCHAR | Eşleşme yapılacak telefon no (Indexli) |
| first_name | VARCHAR | Müşteri Adı |
| last_name | VARCHAR | Müşteri Soyadı |
| notes | TEXT | Genel notlar |
| debt_amount | DECIMAL | Borç tutarı (TL) — Tahsilat modu |
| last_payment_date | DATE | Son ödeme tarihi — Tahsilat modu |
| file_number | VARCHAR | Dosya no (icra, dosya vb.) — Tahsilat modu |
| created_at | TIMESTAMP | Kayıt tarihi |

## 3. Calls (Çağrı Kayıtları - CDR)

Sistemdeki tüm çağrıların detaylı logları.

| Column | Type | Description |
| --- | --- | --- |
| id | UUID | Primary Key |
| asterisk_uniqueid | VARCHAR | Asterisk'in ürettiği benzersiz ID |
| direction | ENUM | 'inbound', 'outbound' — Raporlarda gelen/giden filtreleme için |
| caller_number | VARCHAR | Arayan |
| destination_number | VARCHAR | Aranan |
| agent_id | UUID | Çağrıyı karşılayan ajan (FK -> Users) |
| status | VARCHAR | 'ANSWERED', 'NO ANSWER', 'BUSY' |
| hangup_cause | VARCHAR | Çağrı kapanış nedeni (Normal, BUSY, CONGESTION vb.) — Debug için kritik |
| disposition_code | ENUM | Çağrı sonuç kodu (payment_promise, refused, unreachable, busy, wrong_number) — Tahsilat raporları |
| duration | INT | Konuşma süresi (saniye) |
| recording_path | VARCHAR | Ses kaydının dosya yolu |
| transcript | TEXT | AI transkripsiyon (Faz 2+ — ENTERPRISE_FEATURES) |
| sentiment_score | FLOAT | Duygu analizi skoru -1..1 (Faz 2+) |
| ai_summary | TEXT | Otomatik özet (Faz 2+) |
| external_id | VARCHAR | CRM lead/contact ID (CRM_INTEGRATION) |
| external_type | VARCHAR | `lead`, `contact` vb. |
| callback_url | VARCHAR | Screen Pop için CRM sayfa URL'si |
| started_at | TIMESTAMP | Başlangıç zamanı |

---

## 4. Scripts (Yasal Uyarı Metinleri) — Tahsilat

Tahsilat görüşmelerinde ajanın okuması gereken yasal metinler (KVKK, borç bildirimi vb.).

| Column | Type | Description |
| --- | --- | --- |
| id | UUID | Primary Key |
| name | VARCHAR | Script adı (örn: "Banka X Tahsilat") |
| content | TEXT | Okunacak metin. Placeholder: `{{first_name}}`, `{{last_name}}`, `{{debt_amount}}` |
| is_default | BOOLEAN | Varsayılan script (kampanya atanmamışsa) |
| created_at | TIMESTAMP | Oluşturulma tarihi |

---

## 5. Campaigns (Kampanyalar) — Faz 2+

Otomatik / Power / Predictive / **Preview** dialer kampanyaları.

| Column | Type | Description |
| --- | --- | --- |
| id | UUID | Primary Key |
| name | VARCHAR | Kampanya adı |
| type | ENUM | 'power', 'predictive', 'preview' |
| status | VARCHAR | 'draft', 'active', 'paused', 'completed' |
| queue_id | UUID | FK -> Queues |
| script_id | UUID | FK -> Scripts — Arama anında gösterilecek yasal metin |
| created_at | TIMESTAMP | Oluşturulma tarihi |

## 6. Campaign_Leads (Arama Listesi) — Faz 2+

| Column | Type | Description |
| --- | --- | --- |
| id | UUID | Primary Key |
| campaign_id | UUID | FK -> Campaigns |
| customer_id | UUID | FK -> Customers |
| phone_number | VARCHAR | Aranacak numara |
| status | VARCHAR | 'new', 'pending', 'ringing', 'answered', 'no_answer', 'busy' |
| attempts | INT | Deneme sayısı |
| created_at | TIMESTAMP | Eklenme tarihi |

> **Preview Dialer:** `status='new'` = Sıradaki borçlu, henüz aranmadı. Ajan "Ara" tıklayınca aranır.

---

## 7. Agent_Skills (Yetenek Bazlı Yönlendirme) — Faz 2+

| Column | Type | Description |
| --- | --- | --- |
| id | UUID | Primary Key |
| agent_id | UUID | FK -> Users |
| skill | VARCHAR | Yetenek adı (örn: 'ingilizce', 'teknik', 'satis') |
| level | INT | Puan 1-10 (yüksek = öncelikli) |
| created_at | TIMESTAMP | Atanma tarihi |

---

## 8. Interactions (Omnichannel) — Faz 2+

Müşteri ile tüm etkileşimler (telefon + WhatsApp + Chat).

| Column | Type | Description |
| --- | --- | --- |
| id | UUID | Primary Key |
| customer_id | UUID | FK -> Customers |
| type | ENUM | 'CALL', 'WHATSAPP', 'CHAT' |
| direction | ENUM | 'inbound', 'outbound' |
| call_id | UUID | FK -> Calls (type=CALL ise) |
| content | TEXT | Mesaj içeriği (WhatsApp/Chat için) |
| agent_id | UUID | FK -> Users |
| created_at | TIMESTAMP | Etkileşim zamanı |
