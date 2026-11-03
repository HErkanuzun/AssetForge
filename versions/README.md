# Sürüm arşivi / Version archive

Her AssetForge sürümü burada kendi klasöründe durur. Böylece istediğin sürüme geri dönebilirsin:

```
versions/
  INDEX.md                       ← tüm sürümlerin listesi (otomatik)
  v0.4.4/
    AssetForge-Setup-0.4.4.exe   ← o sürümün kurulum dosyası
    AssetForge-0.4.4-source.zip  ← o sürümün kaynak kodu
    NOTES.md                     ← o sürümde neler değişti
  v0.4.3/
  …
```

Bu klasörün içeriği git'e girmez (kurulum dosyaları ~130 MB). Yalnızca bu README depodadır. Herkes kendi bilgisayarında oluşturur:

```bash
npm run versions            # dist/ içindeki kurulumları ve git etiketlerini arşivler
npm run versions -- --download   # eksik kurulumları GitHub Releases'ten indirir
```

`npm run dist` yeni kurulumu derledikten sonra onu otomatik olarak buraya da kopyalar.

## Eski bir sürüme geri dönmek

**Uygulamayı:** `vX.Y.Z/AssetForge-Setup-X.Y.Z.exe` dosyasını çalıştır. Kurulum mevcut sürümün üzerine yazar. Ayarların, şifreli anahtarların ve projelerin `%APPDATA%\AssetForge` ve proje klasöründe olduğu için korunur. (Kaldırırken "ayarları da sil" sorusuna Hayır de.)

**Kodu:** Her sürüm bir git etiketidir.

```bash
git switch --detach v0.4.3        # o sürümün koduna bak / çalıştır
git switch -c deneme v0.4.3       # o sürümden yeni bir dal başlat
git switch main                   # en yeni sürüme dön
```

Git kullanmadan: `vX.Y.Z/AssetForge-X.Y.Z-source.zip` dosyasını bir klasöre aç, `npm install` ve `npm run dev`.

Tüm sürümler internette de durur: <https://github.com/HErkanuzun/AssetForge/releases>

---

Every AssetForge version lives in its own folder here (installer, source zip and release notes), so you can go back to any of them. The folder's contents are not committed; run `npm run versions -- --download` to fill it. Install an older version by running its setup file (settings and projects are kept), or check out its git tag (`git switch --detach vX.Y.Z`).
