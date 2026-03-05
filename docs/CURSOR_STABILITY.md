# Cursor Kapanma / Donma Önleme Rehberi

Cursor'un ağır projelerde kapanmasını veya donmasını azaltmak için yapılan ayarlar.

---

## 1. `.vscode/settings.json`

- **`editor.formatOnSave: false`** — Kayıtta format çalışmasın (ani CPU yükü azalır).
- **`files.autoSave: "off"`** — Otomatik kayıt kapalı (sürekli tetiklenen işlemler azalır).
- **`files.watcherExclude`** — Şu klasörler dosya izlemesine dahil edilmez:
  - `node_modules`, `venv`, `data`, `uploads`, `recordings`, `dist`, `scripts/local_llm`, `artifacts`, `*.log`, `.git`
- **`search.exclude`** — Aynı klasörler arama sonuçlarına dahil edilmez.

Bu dosya projede mevcutsa Cursor açılışta bu ayarları kullanır.

---

## 2. `.cursorignore`

Cursor'un indekslemeyeceği (ve aramaya dahil etmeyeceği) yollar. **Proje kökünde `.cursorignore` dosyası oluşturup** şu satırları ekleyin:

```
data/
uploads/
recordings/
**/node_modules/
**/venv/
**/scripts/local_llm/
**/artifacts/
*.log
**/dist/
**/.git/
```

*(Bazı ortamlarda bu dosya otomatik oluşturulamayabilir; elle eklemeniz gerekir.)*

---

## 3. Hafif workspace ile açmak (en etkili)

- **Dosya:** `cagri-merkezi-hafif.code-workspace`
- **Açılış:** **File → Open Workspace from File** → bu dosyayı seçin.

Bu workspace'te ağır klasörler Explorer'da gizlenir; Cursor daha az yüklenir.

*(Başka projede kullanmak için bu dosyayı kopyalayıp adını değiştirebilirsiniz, örn. `asistan-hafif.code-workspace`.)*

---

## 4. Cursor ayarları (manuel)

- **Settings → Cursor Settings → Beta:** **Agent Autocomplete** kapalı.
- Az sekme açık tutun; büyük dosyaları (örn. uzun `routes` dosyaları) parça parça açın.

---

## 5. Özet – en etkili iki adım

1. **`cagri-merkezi-hafif.code-workspace`** ile projeyi açmak.
2. **Agent Autocomplete**'i kapatmak.

Bu iki adım genelde kapanma ve donmaları belirgin şekilde azaltır.
