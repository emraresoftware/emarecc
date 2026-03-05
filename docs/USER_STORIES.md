# Kullanıcı Hikayeleri

Her rol için kullanıcı hikayeleri ve kabul kriterleri.

---

## Rol: Temsilci (Agent)

### US-AG-01: Giriş ve Hazır Olma
**Olarak** temsilci  
**İstiyorum ki** sisteme giriş yaptığımda otomatik olarak "Ready" durumuna geçeyim  
**Böylece** gelen aramaları alabileceğim

**Kabul Kriterleri:**
- [ ] Giriş sonrası extension'ıma bağlı softphone aktif
- [ ] Durum "Ready" olarak görünüyor
- [ ] Wallboard'da "available" olarak listeleniyorum

---

### US-AG-02: Gelen Aramayı Alma
**Olarak** temsilci  
**İstiyorum ki** gelen aramada telefon çaldığında "Cevap" butonuna basarak görüşmeyi başlatabileyim  
**Böylece** müşteriyle konuşabilirim

**Kabul Kriterleri:**
- [ ] Çağrı geldiğinde görsel ve sesli uyarı
- [ ] Cevap/Reddet seçenekleri
- [ ] Reddetme durumunda çağrı sonlanır veya yönlendirilir

---

### US-AG-03: Müşteri Kartı Görme (Screen Pop)
**Olarak** temsilci  
**İstiyorum ki** arama geldiği anda tek tıkla müşteri bilgileri ekranıma açılsın  
**Böylece** arayanı tanıyıp hızlıca yardımcı olabilirim

**Kabul Kriterleri:**
- [ ] Arama geldiğinde popup otomatik açılır (tanımlı müşteri varsa)
- [ ] Ad, soyad, telefon, notlar görünür
- [ ] Tanımsız numara ise "Bilinmeyen Arayan" + yeni kayıt formu

---

### US-AG-04: Giden Arama Yapma
**Olarak** temsilci  
**İstiyorum ki** numara çevirip müşteriyi arayabileyim  
**Böylece** geri dönüş veya proaktif arama yapabilirim

**Kabul Kriterleri:**
- [ ] Numarayı manuel girebilme veya müşteri kartından "Ara" butonu
- [ ] Bağlantı kurulduğunda ses akışı başlar
- [ ] Kapatma ile çağrı sonlanır

---

### US-AG-05: Müşteri Notu Ekleme
**Olarak** temsilci  
**İstiyorum ki** görüşme sırasında veya sonrasında müşteriye not ekleyebileyim  
**Böylece** sonraki temsilciler bu bilgiyi görebilir

**Kabul Kriterleri:**
- [ ] Müşteri kartında "Not Ekle" alanı
- [ ] Not kaydedildiğinde tarih ve kullanıcı ile ilişkilendirilir
- [ ] Geçmiş notlar listelenebilir

---

### US-AG-06: Duraklatma (Pause)
**Olarak** temsilci  
**İstiyorum ki** mola veya kısa ara için "Paused" durumuna geçebileyim  
**Böylece** bu sürede bana arama gelmez

**Kabul Kriterleri:**
- [ ] "Pause" butonu ile durum değişir
- [ ] Kuyruğa yeni arama gelmez
- [ ] "Resume" ile tekrar Ready

---

## Rol: Süpervizör (Supervisor)

### US-SV-01: Canlı Kuyruk İzleme
**Olarak** süpervizör  
**İstiyorum ki** tüm ajanların durumunu ve kuyrukta bekleyen aramaları gerçek zamanlı görebileyim  
**Böylece** yük dengeleme ve müdahale yapabilirim

**Kabul Kriterleri:**
- [ ] Wallboard'da tüm ajanlar listelenir
- [ ] Bekleyen çağrı sayısı görünür
- [ ] Ortalama bekleme süresi gösterilir

---

### US-SV-02: CDR Raporları
**Olarak** süpervizör  
**İstiyorum ki** geçmiş çağrıları tarih aralığına göre filtreleyip listeleyebileyim  
**Böylece** performans analizi yapabilirim

**Kabul Kriterleri:**
- [ ] Tarih, ajan, durum filtreleri
- [ ] Toplam süre, cevaplanan/cevapsız sayıları
- [ ] Listeleme sayfalı (pagination)

---

### US-SV-03: Ses Kaydı Dinleme
**Olarak** süpervizör  
**İstiyorum ki** kaydedilmiş çağrıları dinleyebileyim  
**Böylece** kalite kontrol ve eğitim yapabilirim

**Kabul Kriterleri:**
- [ ] CDR listesinde "Dinle" butonu
- [ ] Tarayıcıda audio player ile dinleme
- [ ] Kayıt yoksa bilgi mesajı

---

## Rol: Yönetici (Admin)

### US-AD-01: Temsilci Ekleme
**Olarak** yönetici  
**İstiyorum ki** yeni temsilcileri sisteme ekleyebileyim ve onlara dahili numarası atayabileyim  
**Böylece** ekip genişleyebilir

**Kabul Kriterleri:**
- [ ] Kullanıcı adı, şifre, extension, rol alanları
- [ ] Extension benzersiz olmalı
- [ ] Kayıt sonrası giriş yapabilmeli

---

### US-AD-02: Kuyruk Yönetimi
**Olarak** yönetici  
**İstiyorum ki** kuyrukları tanımlayıp stratejilerini ayarlayabileyim  
**Böylece** arama dağılımı optimale edilebilir

**Kabul Kriterleri:**
- [ ] Kuyruk adı, strateji (ring-all, round-robin vb.)
- [ ] Bekleme müziği, timeout
- [ ] Ajan-kuyruk eşleştirmesi

---

### US-AD-03: Sistem Ayarları
**Olarak** yönetici  
**İstiyorum ki** AMI, SIP trunk gibi sistem parametrelerini yapılandırabileyim  
**Böylece** operasyonel esneklik sağlanır

**Kabul Kriterleri:**
- [ ] AMI host, port, kullanıcı, şifre
- [ ] Değişiklikler kaydedildiğinde servis yeniden bağlanır (gerekirse)

---

## Özet Matris

| Rol | Hikaye Sayısı | MVP (P0) |
|-----|---------------|-----------|
| Agent | 6 | 5 |
| Supervisor | 3 | 2 |
| Admin | 3 | 2 |
