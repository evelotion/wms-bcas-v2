# Roadmap Migrasi Data — WMS BCAS v2

Checklist ini rangkuman dari semua yang udah dibahas. Centang manual tiap kelar satu langkah. Urutannya penting — jangan lompat ke Fase 3 kalau Fase 1-2 belum beres.

---

## ✅ Sudah Selesai
- [x] Fix Vercel build error — cast JWT payload jadi `SessionPayload` di `src/app/login/actions.ts`

---

## ✅ Fase 1 — Persiapan File

- [x] Cari file `Database_Barang.csv` asli di laptop (yang diupload ke chat ini)
- [x] Copy ke **root folder project** (sejajar `package.json`, bukan di dalam subfolder)
- [x] Pastikan nama file persis: `Database_Barang.csv`

## ⏭️ Fase 2 — Bersihin Data CSV (opsional tapi disarankan sebelum import) — DI-SKIP

Prioritas **SEDANG** (isi saldo yang kosong):
- [ ] `IDSS-001` baris 17 — isi Sisa Stock jadi `45`
- [ ] `IDSS-505` baris 219 — isi Sisa Stock jadi `96`
- [ ] `IDSS-128` baris 78 s/d 83 — hitung ulang: 285, 279, 264, 254, 245, **241** (bukan 243)
- [ ] `IDSS-401` baris 213 — perbaiki tanggal & Sisa Stock jadi `197`

Prioritas **RENDAH** (cross-check ke dokumen fisik):
- [ ] `ILSS-301` baris 261 — cek dokumen FPP 129, kemungkinan harusnya `30` bukan `32`
- [ ] `PRO-140` baris 288 — cek dokumen FPP 138, kemungkinan harusnya `27` bukan `35`

**Status:** di-skip sesuai opsi yang disediakan roadmap ini. Konsekuensinya sudah kekonfirmasi pas Fase 5, dan sudah **dikoreksi manual langsung di database** (bukan edit CSV, karena re-import CSV penuh berisiko duplikat data):
- `IDSS-001`: 0 → **45**
- `IDSS-505`: 0 → **96**
- `IDSS-128`: 243 → **241**
- `IDSS-401`: 11 → **197**
- `ILSS-301`: 32 → **30** (pakai angka dugaan roadmap, belum cross-check dokumen fisik FPP 129)
- `PRO-140`: 34 → **27** (pakai angka dugaan roadmap, belum cross-check dokumen fisik FPP 138)

Tiap koreksi tercatat sebagai 1 baris `Mutasi_Ledger` dengan referensi "Koreksi Manual Fase 2 Roadmap" biar ada jejaknya.

## ✅ Fase 3 — Implementasi Kode (via Claude Code di VS Code)

6 perubahan, urutannya bebas tapi semua harus kelar sebelum Fase 4:
- [x] `prisma/schema.prisma` — tambah `satuan_besar`, `isi_per_satuan_besar`, `minimum_order_besar` ke `Master_Barang`
- [x] `package.json` — tambah script `"seed:histori": "tsx prisma/seed-histori-barang.ts"`
- [x] `src/app/master/actions.ts` — create/update simpan field baru
- [x] `src/app/master/page.tsx` — kolom & form konversi kemasan
- [x] `src/app/master/import-actions.ts` — ganti `nomorator:` jadi `nomorator_awal:`
- [x] `prisma/seed-histori-barang.ts` — file baru (parser ledger + multi-batch/lot logic)

## ✅ Fase 4 — Migrasi Database

Jalankan **berurutan**, jangan skip:
```bash
npx prisma db push
npx prisma generate
npm run seed:histori
```
- [x] `prisma db push` sukses (schema baru ter-apply)
- [x] `prisma generate` sukses
- [x] `seed:histori` jalan sampai selesai — baca log akhirnya:
  - `Barang baru (Master)` → **114** ✓ sesuai
  - `Baris di-skip` → **0** ✓ sesuai
  - `⚠️ [PERLU DICEK]` → **7 baris** ✓ sesuai (IDSS-201, IDSS-207, IDSS-508 x2, IDSS-806, PRO-143 x2)

## 🔲 Fase 5 — Verifikasi di Website

- [x] Total Master Barang di database = **114** ✓ (dicek query, belum dicek visual di browser `/master`)
- [x] `IDSS-508` — **DIUBAH dari rencana awal**: bukan digabung 731 dalam 1 batch, tapi dipecah manual jadi **3 lot terpisah** (harga Rp3.467,50 / Rp10.467,50 / Rp11.043,40 sesuai teks di nama), qty masing-masing **0** (sengaja dikosongkan, nunggu diisi manual)
- [x] `PRO-143` — **diputuskan dipisah** (bukan digabung 11 pcs): 3 batch terpisah (Hitam/Coklat/Kream), harga tetap Rp49.000, qty masing-masing **0** (nunggu diisi manual)
- [x] `IDSS-128` — sudah dikoreksi ke **241**
- [x] `IDSS-001`, `IDSS-505`, `IDSS-401`, `ILSS-301`, `PRO-140` — sudah dikoreksi (lihat Fase 2)
- [x] Buka `/master` di browser — **verifikasi parsial**: dev server jalan, auth (JWT) berhasil, halaman render tanpa error, kolom "Satuan Besar" muncul di markup. **Belum** bisa screenshot visual penuh / cek modal & isi tabel dinamis karena environment ini nggak ada `chromium-cli`/Playwright ter-install (belum diinstal, nunggu izin user kalau mau verifikasi visual lebih dalam)
- [ ] Spot-check 2-3 SKU lain random, bandingin sama CSV aslinya

## 🔲 Fase 6 — Commit & Deploy

```bash
git add .
git commit -m "feat: konversi satuan kemasan + migrasi histori barang"
git push
```
- [ ] Push berhasil
- [ ] Vercel auto-deploy sukses (build seharusnya lolos karena bug JWT & `nomorator` udah kefix)

## 🔲 Fase 7 — Ke Depan (Catatan, Bukan Tugas Sekarang)

- Kalau ada PO baru masuk dengan **harga beda** dari batch existing untuk SKU yang sama, tinggal proses lewat alur inbound normal — sistem (`approvePermintaan`) udah otomatis FIFO per-batch berdasarkan `tanggal_masuk`, jadi nggak perlu ubah kode lagi.
- `WMS-TRANSIT-HISTORI-01` adalah lokasi rak sementara buat hasil migrasi — pertimbangkan pindahin ke rak asli kalau udah sempat.

---

**Status saat ini:** kalau lo baru sampai titik ini, langkah paling dekat berikutnya adalah **Fase 1** — pindahin CSV ke folder project.
