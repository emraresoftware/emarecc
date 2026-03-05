# Sistem Mimarisi ve İş Akışı

Bu proje Event-Driven (Olay Güdümlü) bir mimariye sahiptir. Asterisk ve Web arayüzü arasındaki iletişim gerçek zamanlıdır.

## 1. Genel Mimari Şeması

[Asterisk PBX] <--(AMI/TCP)--> [Node.js Backend] <--(WebSocket)--> [React Frontend]
      |                                 |
 [PSTN/VoIP]                     [PostgreSQL & Redis]

## 2. "Screen Pop" (Müşteri Kartı Açma) Akışı

Sistemin en kritik özelliği olan çağrı anında ekran açılması şu adımlarla gerçekleşir:

1.  **Incoming Call (Gelen Çağrı):** Dış dünyadan (SIP Trunk) gelen çağrı Asterisk sunucusuna ulaşır.
2.  **AMI Event:** Asterisk, AMI (Port 5038) üzerinden `NewChannel` veya `AgentConnect` eventini fırlatır.
3.  **Event Parsing (Backend):** Node.js servisimiz bu eventi yakalar.
    * Gelen numara (`CallerID`) alınır.
    * Hangi dahili hatta (`Extension`) yönlendiği tespit edilir.
4.  **Data Enrichment:** Backend, CallerID ile veritabanında sorgu yapar (`SELECT * FROM customers WHERE phone = ?`).
5.  **Socket Emission:**
    * Eğer çağrı 101 nolu dahiliye gidiyorsa, Backend 101 nolu kullanıcının aktif `SocketID`'sini Redis'ten bulur.
    * Sadece o sokete `{ type: 'CALL_START', payload: customerData }` mesajını gönderir.
6.  **Frontend Action:** React istemcisi bu mesajı alır ve `Modal` bileşenini tetikleyerek müşteri kartını ekrana basar.

## 3. Ses İletimi (WebRTC)

Ses trafiği Backend API üzerinden **geçmez**.
* Frontend (SIP.js), doğrudan Asterisk'in WebSocket portuna (örn: 8088/ws) bağlanır.
* Medya (Ses/RTP), tarayıcı ile Asterisk sunucusu arasında peer-to-peer akar.
* **Önemli:** Docker ağ ayarlarında `host` modu veya doğru RTP port aralıklarının açılması hayati önem taşır.
