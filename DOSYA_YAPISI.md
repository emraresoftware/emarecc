# 📁 Emare CC — Dosya Yapısı

> **Oluşturulma:** Otomatik  
> **Amaç:** Yapay zekalar kod yazmadan önce mevcut dosya yapısını incelemeli

---

## Proje Dosya Ağacı

```
/Users/emre/Desktop/Emare/emarecc
├── .DS_Store
├── .env
├── .env.example
├── .gitignore
├── .vscode
│   ├── extensions.json
│   └── settings.json
├── 20140304125509964.pdf
├── 502 - Kapanan Dosyalar rapor çıktısı.xlsx
├── 504 - Dosya Statü Raporu.xlsx
├── 506 - Açık Dosyalar (Detaylı) (5).xlsx
├── 515 - Borçlu GSM Raporu lead.xlsx
├── 516 - Tebligat Sonuçları (1).xlsx
├── CHANGELOG.md
├── CURSOR_STABILITY.md
├── DOSYA_YAPISI.md
├── EMARE_AI_COLLECTIVE.md
├── EMARE_ANAYASA.md
├── EMARE_ORTAK_CALISMA -> /Users/emre/Desktop/Emare/EMARE_ORTAK_CALISMA
├── EMARE_ORTAK_HAFIZA.md
├── README.md
├── RECOMMENDATIONS.md.resolved
├── asterisk_config
│   ├── asterisk.conf
│   ├── extensions.conf
│   ├── http.conf
│   ├── keys
│   │   ├── .gitignore
│   │   ├── asterisk.crt
│   │   └── asterisk.key
│   ├── logger.conf
│   ├── manager.conf
│   ├── modules.conf
│   ├── pjsip.conf
│   └── queues.conf
├── backend
│   ├── .dockerignore
│   ├── .npmrc
│   ├── Dockerfile
│   ├── init.sql
│   ├── migrations
│   │   ├── 001_queue_members.sql
│   │   ├── 002_system_settings.sql
│   │   ├── 003_omnichannel.sql
│   │   ├── 004_calls_customer_id.sql
│   │   ├── 005_password_reset_tokens.sql
│   │   ├── 006_customers_borclu_gsm_columns.sql
│   │   └── 007_customers_owner_id.sql
│   ├── package-lock.json
│   ├── package.json
│   ├── scripts
│   │   ├── migrate.js
│   │   └── seed.js
│   ├── src
│   │   ├── config
│   │   │   ├── db.ts
│   │   │   └── redis.ts
│   │   ├── index.ts
│   │   ├── jobs
│   │   │   └── transcription.ts
│   │   ├── middleware
│   │   │   ├── auth.ts
│   │   │   └── validate.ts
│   │   ├── routes
│   │   │   ├── asterisk.ts
│   │   │   ├── auth.ts
│   │   │   ├── calls.ts
│   │   │   ├── campaigns.ts
│   │   │   ├── chat.ts
│   │   │   ├── customers.ts
│   │   │   ├── debug.ts
│   │   │   ├── queues.ts
│   │   │   ├── scripts.ts
│   │   │   ├── sessions.ts
│   │   │   ├── settings.ts
│   │   │   ├── skills.ts
│   │   │   ├── stats.ts
│   │   │   ├── test.ts
│   │   │   └── users.ts
│   │   ├── services
│   │   │   ├── ami.ts
│   │   │   ├── dialer.ts
│   │   │   └── settings.ts
│   │   ├── sessions.ts
│   │   ├── socket.ts
│   │   ├── types
│   │   │   ├── asterisk-manager.d.ts
│   │   │   └── express.d.ts
│   │   ├── utils
│   │   │   └── logger.ts
│   │   └── workers
│   │       └── transcriptionWorker.ts
│   └── tsconfig.json
├── cagri-merkezi-hafif.code-workspace
├── docker
│   ├── nginx
│   │   └── default.conf
│   ├── nginx.conf
│   └── ssl
│       └── .gitignore
├── docker-compose.prod.yml
├── docker-compose.yml
├── docs
│   ├── API_SPECIFICATION.md
│   ├── ARCHITECTURE.md
│   ├── COLLECTION_MODE.md
│   ├── CRM_INTEGRATION.md
│   ├── CURSOR_CODING_GUIDE.md
│   ├── CURSOR_STABILITY.md
│   ├── DATABASE_SCHEMA.md
│   ├── DEVELOPMENT_ROADMAP.md
│   ├── ENTERPRISE_FEATURES.md
│   ├── FCT_GATEWAY.md
│   ├── FCT_KONTROL_LISTESI.md
│   ├── INDEX.md
│   ├── PRODUCTION_DEPLOYMENT.md
│   ├── REQUIREMENTS.md
│   ├── SETUP_GUIDE.md
│   ├── SKILL_ROUTING.md
│   ├── STRATEGIC_RECOMMENDATIONS.md
│   ├── UI_SCREENS.md
│   ├── USER_STORIES.md
│   ├── WEBRTC_SOFTPHONE.md
│   └── readme.md
├── emarecc_hafiza.md
├── frontend
│   ├── .env.example
│   ├── Dockerfile
│   ├── e2e
│   │   ├── customers.spec.js
│   │   ├── login.spec.js
│   │   ├── reports.spec.js
│   │   └── scripts.spec.js
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── playwright-report
│   │   ├── data
│   │   │   ├── 1a541b130361eec21ff76a5d339b31d34e305e61.zip
│   │   │   ├── 56e725bddbb8843ef3637956c5b0d6613f7b9e6b.md
│   │   │   ├── 887e17d40193df9ceff6d53b4165c8a394cf0315.zip
│   │   │   ├── 9e5554ac7c237c33aadf5a2f44d5c9c26e575c68.md
│   │   │   ├── a098d5fa5dbd27ec9ed9b9c48fb58542d6437a50.md
│   │   │   ├── ae266157a38c06bc2a033e249ab01e39754632be.zip
│   │   │   └── c42e99d5e8be169b8078e1b4a4758f844fa964a6.zip
│   │   ├── index.html
│   │   └── trace
│   │       ├── assets
│   │       ├── codeMirrorModule.DYBRYzYX.css
│   │       ├── codicon.DCmgc-ay.ttf
│   │       ├── defaultSettingsView.7ch9cixO.css
│   │       ├── index.BDwrLSGN.js
│   │       ├── index.BVu7tZDe.css
│   │       ├── index.html
│   │       ├── manifest.webmanifest
│   │       ├── playwright-logo.svg
│   │       ├── snapshot.html
│   │       ├── sw.bundle.js
│   │       ├── uiMode.Btcz36p_.css
│   │       ├── uiMode.CQJ9SCIQ.js
│   │       ├── uiMode.html
│   │       └── xtermModule.DYP7pi_n.css
│   ├── playwright.config.js
│   ├── src
│   │   ├── App.jsx
│   │   ├── components
│   │   │   ├── CustomerExportDialog.jsx
│   │   │   ├── CustomerForm.jsx
│   │   │   ├── CustomerImportDialog.jsx
│   │   │   ├── Layout.jsx
│   │   │   ├── LeadAssignDialog.jsx
│   │   │   ├── QuickDialDialog.jsx
│   │   │   ├── ScreenPopModal.jsx
│   │   │   ├── SipIncomingModal.jsx
│   │   │   ├── SoftphoneWidget.jsx
│   │   │   └── UserForm.jsx
│   │   ├── context
│   │   │   ├── AuthContext.jsx
│   │   │   ├── SipContext.jsx
│   │   │   └── SocketContext.jsx
│   │   ├── main.jsx
│   │   ├── pages
│   │   │   ├── ActiveCalls.jsx
│   │   │   ├── AsteriskStatus.jsx
│   │   │   ├── Campaigns.jsx
│   │   │   ├── ChatInbox.jsx
│   │   │   ├── ChatWidget.jsx
│   │   │   ├── CustomerDetail.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── LiveSessions.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Logs.jsx
│   │   │   ├── PreviewDialer.jsx
│   │   │   ├── Queues.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── ResetPassword.jsx
│   │   │   ├── Scripts.jsx
│   │   │   ├── Settings.jsx
│   │   │   ├── SoftphoneSettings.jsx
│   │   │   ├── Users.jsx
│   │   │   ├── Wallboard.jsx
│   │   │   └── WallboardPublic.jsx
│   │   └── utils
│   │       └── api.js
│   ├── test-results
│   │   ├── .last-run.json
│   │   ├── customers-Müşteriler-müşteriler-sayfası-açılır-chromium
│   │   │   └── error-context.md
│   │   ├── customers-Müşteriler-müşteriler-sayfası-açılır-chromium-retry1
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── customers-Müşteriler-müşteriler-sayfası-açılır-chromium-retry2
│   │   │   └── error-context.md
│   │   ├── customers-Müşteriler-yeni-müşteri-formu-açılır-chromium
│   │   │   └── error-context.md
│   │   ├── customers-Müşteriler-yeni-müşteri-formu-açılır-chromium-retry1
│   │   │   └── trace.zip
│   │   ├── reports-Raporlar-raporlar-sayfası-açılır-ve-CDR-görünür-chromium
│   │   │   └── error-context.md
│   │   ├── reports-Raporlar-raporlar-sayfası-açılır-ve-CDR-görünür-chromium-retry1
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── reports-Raporlar-raporlar-sayfası-açılır-ve-CDR-görünür-chromium-retry2
│   │   │   └── error-context.md
│   │   ├── scripts-Scriptler-scriptler-sayfası-açılır-chromium
│   │   │   └── error-context.md
│   │   ├── scripts-Scriptler-scriptler-sayfası-açılır-chromium-retry1
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   └── scripts-Scriptler-scriptler-sayfası-açılır-chromium-retry2
│   │       └── error-context.md
│   └── vite.config.js
├── frontend_dist
│   ├── assets
│   │   └── index-2JYNosaY.js
│   └── index.html
├── öner.md
├── recordings
│   └── .gitkeep
├── scripts
│   └── generate-local-certs.sh
└── start.sh

48 directories, 196 files

```

---

## 📌 Kullanım Talimatları (AI İçin)

Bu dosya, kod üretmeden önce projenin mevcut yapısını kontrol etmek içindir:

1. **Yeni dosya oluşturmadan önce:** Bu ağaçta benzer bir dosya var mı kontrol et
2. **Yeni klasör oluşturmadan önce:** Mevcut klasör yapısına uygun mu kontrol et
3. **Import/require yapmadan önce:** Dosya yolu doğru mu kontrol et
4. **Kod kopyalamadan önce:** Aynı fonksiyon başka dosyada var mı kontrol et

**Örnek:**
- ❌ "Yeni bir auth.py oluşturalım" → ✅ Kontrol et, zaten `app/auth.py` var mı?
- ❌ "config/ klasörü oluşturalım" → ✅ Kontrol et, zaten `config/` var mı?
- ❌ `from utils import helper` → ✅ Kontrol et, `utils/helper.py` gerçekten var mı?

---

**Not:** Bu dosya otomatik oluşturulmuştur. Proje yapısı değiştikçe güncellenmelidir.

```bash
# Güncelleme komutu
python3 /Users/emre/Desktop/Emare/create_dosya_yapisi.py
```
