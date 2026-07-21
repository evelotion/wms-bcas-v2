# INSTRUKSI EKSEKUSI — Fase 3B + 3C (Schema Kode GL + Seed v2 Buku Besar)

> Untuk Claude Code di VS Code. Konteks project ada di `CLAUDE.md` / `Roadmap_WMS_v3.md`.
> Spec lengkap yang jadi acuan: **`SPEC_FASE_3B_3C_SEED_V2.md`** (sudah di-review & APPROVED oleh sesi chat claude.ai tanggal 20 Jul 2026). Instruksi ini = perintah eksekusi spec itu + 4 penyesuaian hasil review di bawah.

## Situasi terkini (penting)
- Database yang ditunjuk `.env` saat ini **KOSONG** (dikonfirmasi via `npm run dev` — tidak ada data sama sekali). Karena itu, precondition "backup data testing Fase 4" di spec **GUGUR** — tidak ada data yang perlu diselamatkan, dan urutan eksekusi resmi di-swap: **seed v2 duluan, testing Fase 4 setelahnya.**
- Login tetap jalan lewat auto-seed user di `loginUser` (admin/123 & gudang/123 dibuat otomatis saat login pertama).

## Eksekusi (urut, jangan loncat)

### 1. Fase 3B — Schema
Tambah ke `Master_Barang` di `prisma/schema.prisma`:
```prisma
kode_gl       String? // Kode akun GL, contoh "1442301"
keterangan_gl String? // Contoh "BARANG CETAKAN"
```
Lalu:
```bash
npx prisma validate && npx prisma db push && npx prisma generate
```
Tampilkan `kode_gl` (+ `keterangan_gl` sebagai tooltip/subteks) di tabel `/master` dan di `/master/detail/[id]` — read-only display saja, ikuti gaya glassmorphism existing.

### 2. Fase 3C — Tulis `prisma/seed-buku-besar-v2.ts`
Implementasi PERSIS mengikuti `SPEC_FASE_3B_3C_SEED_V2.md` Step 0–4 (wipe → master+GL → batch dari sheet `Harga_FIFO_Stok_Aktif` → replay mutasi Juli → rekonsiliasi), dengan **4 penyesuaian hasil review**:

1. **Rekonsiliasi diperkuat (WAJIB - ini perubahan paling penting).** Step 4 di spec cuma cek total nilai. Tambahkan **cek qty per-SKU**: untuk tiap SKU, `SUM(qty_sisa)` semua batch-nya di DB harus == angka kolom `Sisa Stock` TERAKHIR SKU itu di sheet `Buku_Besar`, dikonversi ke satuan kecil (`sisa_stock × isi_per_satuan_besar`). Print tabel hasil: SKU | qty DB | qty Buku Besar (kecil) | selisih. Kalau ada selisih ≠ 0, print WARNING per SKU tapi jangan hard-fail — selisih adalah sinyal kemungkinan double-count mutasi Juli (snapshot sistem mungkin sudah menyerap sebagian transaksi awal Juli). Laporkan daftar selisihnya untuk direview.
2. **`IDSS-712` (sel tanggal `' 4 '`)**: implementasikan skip-with-warning persis seperti catatan spec — JANGAN menebak tanggal. Kalau saat eksekusi ternyata user sudah memperbaiki sel itu di Excel, baris ikut ter-replay normal; script harus handle dua-duanya.
3. **`Sequence_Counter` TIDAK di-reset dan TIDAK di-wipe** (sesuai spec). Karena DB kosong dan testing jalan SETELAH seed, penomoran produksi otomatis mulai bersih — tidak perlu logika tambahan.
4. Tambah npm script: `"seed:v2": "tsx prisma/seed-buku-besar-v2.ts"`.

Catatan implementasi dari spec yang sering kelewat — pastikan ikut:
- Baca Excel pakai `XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })`, strip koma untuk angka & Kode GL.
- Batch dibuat dari sheet `Harga_FIFO_Stok_Aktif` (sudah final per tingkat harga), BUKAN dari raw `Buku_Besar`. Skip baris "Ada di Buku Besar" = `Tidak`.
- `tanggal_masuk` batch: cari match harga (epsilon 0.5) di `Buku_Besar` → fallback tanggal sintetis `2026-07-01` + offset `Tingkat Harga ke-` (urutan FIFO harus tetap: tingkat 1 = tertua).
- Replay mutasi Juli urut tanggal ascending; OUTBOUND potong FIFO persis pola `prosesAdjustmentFpkb`; nomor dokumen asli (mis. `104/FPP/LOG/2026`) masuk `Mutasi_Ledger.referensi`.
- `IDSS-302`: Master_Barang dibuat, TANPA batch (stok 0 sampai ada inbound resmi via website).

### 3. Jalankan & verifikasi
```bash
npm run seed:v2
npm run build
```
Kriteria lolos:
- Seed selesai tanpa error, `IDSS-712` muncul sebagai warning skip (kecuali sudah diperbaiki di Excel)
- Rekonsiliasi total nilai ≈ Rp 982.691.570,50 minus net outflow Juli (print angka pastinya)
- Rekonsiliasi per-SKU: mayoritas selisih 0; yang selisih ≠ 0 di-print sebagai daftar warning
- Jumlah SKU di Master_Barang = 112 (dari Buku Besar; 18 SKU sistem-only di-skip)
- `npm run build` sukses

### 4. Laporan balik (buat cross-check ke sesi chat)
Print/laporkan di akhir:
1. Output rekonsiliasi Step 4 lengkap (total nilai + tabel selisih per-SKU kalau ada)
2. Jumlah: Master_Barang, Batch_Barang, Mutasi_Ledger (INBOUND opening / INBOUND Juli / OUTBOUND Juli)
3. Spot-check 3 SKU: `IDSS-508` (harus 3 batch harga beda), `IDSS-179` (konversi 1 Pack = 1.000 Lembar), `UMMS-501` (2 batch)
4. Daftar warning/skip yang muncul

## Yang JANGAN dilakukan
- Jangan ubah file lain di luar scope (schema, seed baru, display GL di /master, package.json script) — halaman fpkb/permintaan/outstanding/inventory JANGAN disentuh.
- Jangan jalankan seed ke production Neon Vercel — hanya ke DATABASE_URL di `.env` lokal dulu. Replikasi ke production nanti setelah angka diverifikasi & Fase 4 lolos.
- Jangan commit `.env`.

Setelah selesai: commit + push dengan pesan `feat: kode GL di master barang + seed v2 dari buku besar gabungan (fase 3B/3C)`, lalu user akan cross-check hasilnya ke sesi chat claude.ai.
