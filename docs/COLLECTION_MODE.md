# Tahsilat (Collection) Modu

OpenCC'nin tahsilat/borc takip senaryoları için özelleştirmeleri.

---

## 1. Özellik Özeti

| Özellik | Açıklama | Teknik |
|---------|----------|--------|
| **Preview Dialer** | Ajan tek tek numara çevirmez; önüne borçlu listesi gelir, "Ara" ile sırayla arar | `GET /campaigns/:id/next-lead` |
| **Disposition Codes** | Çağrı bitiminde sonuç kodu (Ödeme Sözü, Ulaşılamadı vb.) | `Calls.disposition_code` |
| **Scripting** | Yasal uyarı metni arama anında gösterilir | `Scripts` tablosu, Screen Pop |
| **Borç Alanları** | Müşteri kartında borç tutarı, son ödeme, dosya no | `Customers.debt_amount`, vb. |

---

## 2. Disposition Kodları

| Kod | Açıklama | Raporlarda |
|-----|----------|------------|
| payment_promise | Ödeme sözü verdi | Evet |
| refused | Reddetti | Evet |
| unreachable | Ulaşılamadı | Evet |
| busy | Meşgul | Evet |
| wrong_number | Yanlış numara | Evet |

Yönetici gün sonunda: "Kaç Ödeme Sözü? Kaç Ulaşılamadı?" raporları alabilir.

---

## 3. Script (Yasal Metin) Akışı

1. Kampanya bir **Script** ile ilişkilendirilir (`Campaigns.script_id`)
2. Ajan `next-lead` çağırdığında veya Screen Pop açıldığında `script.content` döner
3. Placeholder'lar doldurulur: `{{first_name}}`, `{{last_name}}`, `{{debt_amount}}`, `{{file_number}}`
4. Ajan arama bağlandığı anda metni okur (yasal zorunluluk)

**Örnek script:**
```
Sayın {{first_name}} {{last_name}}, [Banka Adı] borcunuzla ilgili arıyorum. 
Görüşmemiz kayıt altına alınmaktadır. Borç tutarınız {{debt_amount}} TL'dir. 
KVKK kapsamında bilgilendirme...
```

---

## 4. Veritabanı Özeti

- **Customers:** debt_amount, last_payment_date, file_number
- **Calls:** disposition_code
- **Scripts:** id, name, content, is_default
- **Campaigns:** script_id, type='preview'
- **Campaign_Leads:** status='new' (sıradaki borçlu)

Detay: [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)

---

## 5. API Özeti

- `GET /campaigns/:id/next-lead` — Sıradaki borçlu + script
- `PATCH /calls/:id` — disposition_code atama
- `GET/POST/PATCH /scripts` — Script yönetimi

Detay: [API_SPECIFICATION.md](API_SPECIFICATION.md)
