# Roadmap — WMS BCAS v2

Living checklist. Ada 2 bagian besar: migrasi data histori (udah dianggap kelar) dan enhancement alur FPP → FPKB → Outstanding (lagi jalan).

---

# Bagian 1 — Migrasi Data Histori (CSV → Database)

## ✅ Semua Fase Selesai

- [x] Fix Vercel build error — cast JWT payload jadi `SessionPayload`
- [x] **Fase 1** — Pindahin `Database_Barang.csv` ke root folder project
- [x] **Fase 2** — Bersihin data CSV (IDSS-001, IDSS-505, IDSS-128 cascading, IDSS-401, ILSS-301, PRO-140)
- [x] **Fase 3** — Implementasi 6 perubahan kode (schema, package.json, master/actions.ts, master/page.tsx, import-actions.ts fix, seed-histori-barang.ts)
- [x] **Fase 4** — `npx prisma db push` + `npx prisma generate` + `npm run seed:histori`
- [x] **Fase 5** — Verifikasi di `/master` & `/master/detail/[id]` (termasuk IDSS-508 jadi 731 pcs 1 batch, PRO-143 digabung/dipisah sesuai keputusan lo)
- [x] **Fase 6** — Commit & push, Vercel auto-deploy sukses
- [x] **Fase 7 (ongoing)** — Sistem siap terima PO harga beda per SKU lewat alur inbound normal (FIFO otomatis)

---

# Bagian 2 — Enhancement Alur FPP → FPKB → Outstanding

## ✅ Fase 1 — Konfirmasi Alur & Arsitektur

- [x] Konfirmasi alur bisnis final:
  Cabang kirim FPP via email PDF → **Staf** input ke website (auto-generate nomor FPKB) → masuk ke **Admin Gudang** → Admin Gudang adjustment/realisasi & potong stok → barang tereleminasi jadi **Outstanding** (FPP+FPKB asal tetap ke-link) → serah terima (JABODETABEK: FPKB aja / NON-JABODETABEK: FPKB + BAST + no. Airwaybill) → Admin Gudang upload dokumen signed
- [x] Konfirmasi role mapping: `ADMIN` = Staf, `GUDANG` = Admin Gudang (nggak perlu role baru)
- [x] Review dokumen contoh: FPKB dengan kolom Realisasi (2 halaman) & form BAST
- [x] Sepakat: semua nomor urut (FPP/FPKB/BAST) mulai dari `1`, nama-nama orang dikosongin dulu

## ⚠️ Fase 2 — Schema & Logic Inti (DIDESAIN, BELUM DITERAPKAN KE REPO)

**Update 20 Jul:** Dicek langsung ke `github.com/evelotion/wms-bcas-v2` — ternyata repo masih di kondisi SEBELUM restrukturisasi ini. Yang ada di repo sekarang cuma versi awal (`generateFpkb.ts` buat cetak PDF client-side, dibuat sengaja sebagai eksperimen duluan) yang jalan di atas schema LAMA. Semua desain di bawah ini masih di sandbox chat, siap dipindah:

- [x] `prisma/schema.prisma` — desain restrukturisasi total (model `Fpkb`, `Fpkb_Item`, `Sequence_Counter`, enum `StatusFpp`/`StatusFpkb`/`WilayahCabang`) — **belum di-apply**
- [x] `src/lib/sequence.ts` — desain helper penomoran sequential — **belum dibuat di repo**
- [x] `src/app/permintaan/actions.ts` — desain rewrite sisi Staf — **repo masih pakai versi lama** (`getDaftarPermintaan`, `approvePermintaan` dengan nomor FPP diketik manual & format FPKB asli)
- [x] `src/app/fpkb/actions.ts` — desain sisi Admin Gudang — **belum ada folder `/fpkb` di repo sama sekali**
- [x] `src/app/outstanding/actions.ts` — desain query gabungan — **repo masih pakai `resolveOutstandingItem` (fulfill langsung, bukan ticketing/reissue FPKB)**
- [x] `src/app/actions.ts` — desain `getFpkbAlerts()` — **belum ada di repo**

## 🔲 Fase 2.5 — Sinkronisasi Desain ke Repo (LANGKAH BERIKUTNYA)

- [ ] Apply schema baru (replace total isi `prisma/schema.prisma` bagian Permintaan/Fpkb)
- [ ] Buat `src/lib/sequence.ts`
- [ ] Replace `src/app/permintaan/actions.ts` dengan versi baru
- [ ] Buat folder baru `src/app/fpkb/` + `actions.ts`
- [ ] Replace `src/app/outstanding/actions.ts` dengan versi baru
- [ ] Tambah `getFpkbAlerts()` ke `src/app/actions.ts`
- [ ] **Rework `src/lib/generateFpkb.ts`** — ini yang paling penting buat dibersihin:
  - [ ] Hapus nama hardcoded ("Novianti Siswandi", "Ikbal Kurnia", "Dian .....") — ganti jadi kosong/parameter opsional sesuai kesepakatan awal
  - [ ] Tambah kolom **Realisasi** di tabel PDF (sesuai `Contoh_FPKB_-_Cetakan_dengan_Realisasi_kolom.pdf`)
  - [ ] Sesuaikan input data: sekarang generate dari `Fpkb` + `Fpkb_Item`, bukan `Permintaan_Header` + `Permintaan_Detail`
  - [ ] Buat fungsi baru serupa buat generate BAST (khusus `NON_JABODETABEK`)
- [ ] Rewrite `permintaan/page.tsx` — hapus input manual nomor FPP, ganti jadi auto-generate; hapus pemanggilan `approvePermintaan` lama
- [ ] Rewrite `outstanding/page.tsx` — ganti dari "fulfill langsung" jadi tombol "Tutup" / "Proses Ulang (terbitkan FPKB baru)"
- [ ] Halaman baru `src/app/fpkb/page.tsx` — antrean Admin Gudang, upload serah terima
- [ ] Update dashboard (`src/app/page.tsx`) — tampilkan alert dari `getFpkbAlerts()`
- [ ] Update label role di UI: `ADMIN` → "Staf", `GUDANG` → "Admin Gudang"

## 🔲 Fase 4 — Migrasi Database

```bash
npx prisma validate   # WAJIB - sandbox Claude nggak bisa validasi network-restricted
npx prisma db push
npx prisma generate
```
- [ ] `prisma validate` clean
- [ ] `prisma db push` sukses — **catatan:** bakal ada prompt data-loss untuk kolom lama yang dihapus (`Permintaan_Header.nomor_fpkb`, `gudangId`, `Permintaan_Detail.qty_disetujui`). Aman di-accept kalau belum ada data produksi FPP/FPKB asli.
- [ ] `prisma generate` sukses

## 🔲 Fase 5 — Testing Alur End-to-End

- [ ] Input FPP baru (Staf) → cek nomor FPKB otomatis ke-generate
- [ ] Adjustment FPKB (Admin Gudang) → cek stok kepotong FIFO dengan benar
- [ ] Barang kurang → cek muncul di Outstanding dengan info FPP+FPKB asal
- [ ] Reissue outstanding → cek FPKB baru ke-generate, tetap ke-link ke FPP yang sama
- [ ] Tutup outstanding (reject) → cek status FPP jadi `CLOSED` kalau nggak ada outstanding lain
- [ ] Serah terima JABODETABEK → cek upload FPKB signed aja cukup, status jadi `SELESAI`
- [ ] Serah terima NON-JABODETABEK → cek wajib isi Airwaybill + upload BAST juga
- [ ] Alert dashboard — restock yang nutupin outstanding muncul, FPKB nunggak serah-terima muncul di Admin Gudang

## 🔲 Fase 6 — Commit & Deploy

```bash
git add .
git commit -m "feat: alur FPP ke FPKB dengan multi-FPKB per FPP, outstanding ticketing, serah terima JABODETABEK/non"
git push
```
- [ ] Push berhasil, Vercel build sukses

---

**Status saat ini:** Bagian 1 kelar. Bagian 2 baru sampai **desain di sandbox chat** — repo aslinya masih di versi awal (`generateFpkb.ts` eksperimen + schema lama). Langkah berikutnya: **Fase 2.5 (Sinkronisasi)** — pindahin semua desain ke repo, termasuk bersihin nama hardcoded & nambah kolom Realisasi di PDF generator. Disarankan dikerjain bareng Claude Code di VS Code, kasih tau dia buat baca `src/lib/generateFpkb.ts` yang ada sekarang sebagai referensi struktur PDF, terus modifikasi sesuai spesifikasi di atas — jangan bikin dari nol biar layout PDF-nya tetap konsisten.
