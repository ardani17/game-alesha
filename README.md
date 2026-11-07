# Game Alesha

Kumpulan **permainan balita** (usia 2+) — pilih permainan dari menu utama:
**Menggambar** (mewarnai & gambar bebas), **Berhitung** (mengenal angka 1–5),
**Belajar Huruf** (kenalan A–Z dengan suara), dan **Membaca** (susun huruf
jadi kata berpandu gambar). Dibangun dengan Next.js 16 + TypeScript +
Tailwind CSS v4, dibundel menjadi **APK Android offline** via
[Capacitor](https://capacitorjs.com), dengan **rilis melalui GitHub
Releases** (tanpa Play Store).

## Arsitektur

- `next build` dengan `output: "export"` → seluruh aplikasi statis di `out/`
  (halaman, gambar, dan 81 klip suara) — **semuanya ter-bundle di dalam
  APK**, jalan 100% tanpa internet.
- Capacitor (`android/`) membungkus `out/` menjadi aplikasi Android native
  (`com.ardani.gamealesha`). Service worker otomatis dinonaktifkan di dalam
  APK (asets sudah lokal).
- **Rilis & pembaruan otomatis via GitHub**: GitHub Actions mem-build APK
  setiap tag `v*` di-push dan mengunggahnya ke GitHub Releases. Aplikasi
  **mengecek rilis baru otomatis saat dibuka** (dan lewat tombol "Cek
  pembaruan"); bila ada versi baru, pengguna tinggal menekan
  **"Perbarui sekarang"** — APK **diunduh langsung di dalam aplikasi**
  (dengan bilah progres) lalu pemasang Android terbuka otomatis. Tidak
  perlu buka browser / unduh manual. Berlaku juga untuk update berikutnya:
  sekali izin "install aplikasi tidak dikenal" diberikan ke aplikasi ini,
  pembaruan selanjutnya hanya perlu satu tombol.
  Catatan: pembaruan menimpa instalasi lama **tanpa uninstall** hanya bila
  semua rilis ditandatangani keystore yang sama (lihat secrets di bawah).

## Alur rilis (GitHub, tanpa Play Store)

1. **Sekali saja — siapkan repo & signing:**
   ```bash
   git init && git add . && git commit -m "Game Alesha"
   gh repo create gamealesha --private --source=. --push   # atau buat manual di GitHub

   # keystore untuk APK bertanda tangan tetap (update menimpa, tanpa uninstall):
   keytool -genkey -v -keystore gamealesha.keystore -alias gamealesha \
     -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 gamealesha.keystore   # salin hasilnya
   ```
   Tambahkan GitHub Secrets: `ANDROID_KEYSTORE_BASE64`,
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
   Lalu isi `src/data/app-config.json` → `"githubRepo": "username/gamealesha"`.

2. **Setiap rilis:**
   ```bash
   node scripts/version.mjs 1.1.0        # naikkan versi di semua tempat
   git add -A && git commit -m "v1.1.0"
   git tag v1.1.0 && git push origin main --tags
   ```
   GitHub Actions build APK (signed) → muncul di **Releases** (draft) →
   publish. Pengguna tinggal buka link release dari HP, unduh APK, install
   (izinkan "install dari sumber tidak dikenal" sekali).

3. **Di aplikasi lama**: saat dibuka (online), aplikasi otomatis mendeteksi
   versi baru → tombol **Perbarui sekarang** → APK terunduh di dalam
   aplikasi → pemasang terbuka → konfirmasi **Install**. Selesai — aplikasi
   langsung jadi versi baru. (Saat pertama kali, Android meminta izin
   "biarkan aplikasi ini menginstal aplikasi tidak dikenal" — izinkan satu
   kali.)

> Tanpa secrets keystore, workflow tetap jalan tapi menghasilkan APK debug
> (beda tanda tangan tiap rilis → update perlu uninstall dulu).

## Build lokal (opsional)

```bash
npm run apk          # build web + sync ke android/
npx cap open android # Android Studio -> Build > Build APK(s)
```
Butuh Android Studio + JDK 17+. Tanpa itu, cukup pakai rilis GitHub Actions.

## Menjalankan mode web / development

```bash
npm run dev   # http://localhost:3000
npm run build # hasil statis di out/ (bisa di-hosting mana saja)
```

## Mulai cepat

```bash
npm install
npm run dev        # http://localhost:3000 (SW nonaktif saat dev)
```

Mode PWA penuh (service worker aktif):

```bash
npm run build      # next build && serwist build -> public/sw.js
npm start          # http://localhost:3000
```

Setelah itu aplikasi bisa di-**install** dari browser (Chrome/Edge: ikon
install di address bar; iOS Safari: Share → Add to Home Screen) dan tetap
bisa dipakai offline.

## Fitur aplikasi

**Menu utama** — pilih permainan; setiap game punya tombol kembali ke menu.

**Menggambar & Mewarnai**
- 8 halaman mewarnai (Ikan, Burung Beo, Kupu-Kupu, Kucing, Mobil, Rumah,
  Dino, Bunga) + mode **Gambar Bebas** (brush/rainbow).
- Mesin *rub-to-color*: area yang dilesak jari langsung terisi warna;
   multi-touch, satu goresan per jari.
- Mode **Warna Ajaib** (rainbow) atau pilih warna dari palet.
- Simpan gambar, undo, hapus; hasil mewarnai **tersimpan otomatis** di
  localStorage (aman saat di-reload).

**Berhitung**
- "Ada berapa…?" — pertanyaan **dilafalkan dengan suara** saat ronde baru
  ("Ada berapa ikan?"), lalu sentuh benda satu-satu; setiap sentuhan
  memunculkan badge nomor berurutan + nada naik **+ angka terlafal**
  ("satu", "dua", …).
- Ronde pertama naik perlahan 1→5, lalu acak 2–5; benda beragam
  (apel, bebek, balon, ikan, bunga, …).
- Selesai dihitung: angka besar + kata (satu, dua, …), confetti, fanfare,
  dan suara **"Hebat! dua ikan!"** — lalu otomatis lanjut ke ronde
  berikutnya (atau tekan "Lagi ➜").

**Membaca**
- Gambar jadi petunjuk: susun ubin huruf acak menjadi kata (Bola, Apel,
  Ikan, Sapi, Topi, Roti, Ular, Nanas, Mobil, Gajah, Zebra, Kucing),
  dari kiri ke kanan — slot menampilkan huruf samar sebagai panduan.
- Setiap huruf yang disentuh **dilafalkan satu per satu**; kata diucapkan
  utuh saat ronde baru & saat selesai ("Hebat! Apel!") + confetti.
- Sentuh gambar untuk mengulang kata; huruf salah hanya menggoyang ubin
  (tanpa hukuman).

**Belajar Huruf**
- Kartu huruf besar A–a + gambar & kata (A untuk Apel, B untuk Bola, …).
- Sentuh kartu: huruf dilafalkan dengan **suara neural Bahasa Indonesia
  asli** — 26 file MP3 di `public/audio/huruf/` (diprecahce, tetap bunyi
  offline). Bila file hilang, jatuh ke Web Speech API dengan pemilih voice
  Indonesia otomatis.
- Panah besar untuk huruf sebelumnya/berikutnya + strip A–Z untuk lompat
  langsung ke huruf mana pun.

### Memperbarui suara lafalan (gratis)

```bash
python -m pip install edge-tts   # sekali saja
python scripts/generate_tts.py   # 81 MP3: huruf, angka, berhitung, membaca
```

Voice dipakai: **`id-ID-GadisNeural`** (perempuan) / ganti ke
**`id-ID-ArdiNeural`** (laki-laki) di `scripts/generate_tts.py`. Data kata
dikelola di `src/data/letters.json` (A–Z), `src/data/counting.json`
(benda berhitung), dan `src/data/reading.json` (kata membaca) — satu
sumber untuk UI & audio.

**Umum**: efek suara Web Audio (tanpa file aset), sparkle, haptic buzz,
animasi framer-motion, gaya visual balita (font Fredoka, tema krem).

## Struktur penting

| Berkas / folder | Fungsi |
| --- | --- |
| `src/components/game-app.tsx` | Switcher: menu ⇄ tiap game |
| `src/components/game-menu.tsx` | Menu utama pilih permainan |
| `src/components/drawing-app.tsx` | Game menggambar & mewarnai |
| `src/components/counting-game.tsx` | Game berhitung 1–5 |
| `src/components/letters-game.tsx` | Game belajar huruf A–Z + suara |
| `src/components/reading-game.tsx` | Game membaca: susun huruf jadi kata |
| `src/data/letters.json` | Data A–Z (satu sumber untuk UI & audio) |
| `src/data/reading.json` | Data kata untuk game membaca |
| `src/data/counting.json` | Data benda untuk game berhitung |
| `src/lib/tts.ts` | Pemutar MP3 lafalan + fallback Web Speech |
| `scripts/generate_tts.py` | Generate 43 MP3 lafalan via edge-tts (gratis) |
| `src/components/coloring-svg.tsx` | Renderer SVG halaman mewarnai |
| `src/lib/coloring-pages.ts` | Definisi 8 halaman mewarnai (shape SVG) |
| `src/lib/sounds.ts` | Efek suara Web Audio |
| `src/components/ui/` | Komponen shadcn/ui |
| `src/app/manifest.ts` | Web app manifest PWA |
| `src/app/sw.ts` + `serwist.config.js` | Service worker (precache + offline fallback) |
| `src/app/offline/page.tsx` | Halaman fallback saat offline |
| `scripts/generate-icons.mjs` | Generator ikon PWA: `node scripts/generate-icons.mjs` |

## Catatan teknis

- Serwist dipakai dalam **configurator mode** agar kompatibel dengan
  Turbopack (bundler default Next.js 16).
- Rute yang di-prerender otomatis di-precache; navigasi offline ke rute
  yang belum di-cache dialihkan ke `/offline`.
- `public/sw*` adalah artefak hasil generate (sudah di-`.gitignore`).
- Mengubah/menambah halaman mewarnai: edit `src/lib/coloring-pages.ts`.
- Referensi TTS Bahasa Indonesia gratis:
  [edge-tts](https://pypi.org/project/edge-tts/) (voice neural id-ID,
  dipakai aplikasi ini), [gTTS](https://pypi.org/project/gTTS/) (Google
  Translate, voice `id`), voice Windows **Microsoft Andika** (Settings →
  Language → Indonesia → Text-to-speech, gratis, dipakai otomatis oleh Web
  Speech API), dan [Google Cloud TTS](https://cloud.google.com/text-to-speech)
  (free tier 1 juta karakter/bulan, butuh API key).

## Belajar Next.js

- [Dokumentasi Next.js](https://nextjs.org/docs)
- [Dokumentasi Serwist](https://serwist.pages.dev/docs/next)
