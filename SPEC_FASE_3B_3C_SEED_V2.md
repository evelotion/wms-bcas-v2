# Spec — Fase 3B & 3C: Kode GL + Seed v2 dari Buku Besar

> Ditulis 20 Jul 2026 berdasarkan hasil analisis langsung terhadap `Buku_Besar_Update_GL_FIFO.xlsx` (3 sheet: `Buku_Besar`, `Harga_FIFO_Stok_Aktif`, `Ringkasan`) dan cross-check ke `prisma/schema.prisma`, `prisma/seed-histori-barang.ts`, `src/lib/pricing.ts`, `src/app/fpkb/actions.ts` (`prosesAdjustmentFpkb`).

## Keputusan Fase 3A yang jadi input spec ini
1. Strategi: **WIPE & re-import bersih** (bukan merge) — terbukti `Buku_Besar` adalah kelanjutan persis ledger yang sama dengan `Database_Barang.csv` (114/116 SKU cocok baris-per-baris).
2. GL `IDSS-302` & `IDSS-505` = **CTK/1442301**.
3. Sel tanggal `IDSS-712` (`' 4 '`) — **belum diperbaiki di Excel**. Row-nya: `Buku_Besar` baris index ~237 (Kode Barang `IDSS-712`, Barang Keluar=2, No FPKB `00089/FPKB/LOG/2026`). **BLOCKER**: perbaiki manual di Excel dulu sebelum jalankan seed, atau seed script fallback ke tanggal terdekat (lihat catatan di bagian Mutasi Juli).
4. 18 SKU yang ada stok di sistem lama tapi tidak ada di Buku Besar → **skip, tidak di-seed** (daftar: `PRO-142`, `PRO-Tumbler`, `BRG-005/006/009/100/101/103`, `IDSS-509`, `IDSS-911`, `SDBS-705-NJ`, `PRO-004/044/115/121/123/133/138/139`).
5. Mapping konversi satuan: kolom **"Jumlah / Unit Serah Terima"** di sheet `Buku_Besar` dipakai langsung sebagai `isi_per_satuan_besar` (sama pola dengan kolom "Jumlah / Unit" di seed Bagian 1). Dari 112 SKU unik: **84 butuh konversi > 1**, 28 sudah 1:1.

## Precondition sebelum eksekusi (WAJIB dicek)
- [ ] Sel `IDSS-712` sudah diisi tanggal yang benar di Excel (bukan `' 4 '` lagi).
- [ ] **Tidak ada data FPP/FPKB produksi yang penting** di database saat ini — wipe akan menghapus SEMUA `Permintaan_Header` (cascade ke `Fpkb`, `Fpkb_Item`, `Permintaan_Detail`, `Permintaan_Outstanding`) karena tabel-tabel itu punya FK ke `Master_Barang` yang juga di-wipe. Kalau Fase 4 testing (S1-S7) sudah menghasilkan data yang mau dipertahankan sebagai bukti/log, **backup dulu** (export atau screenshot) sebelum run seed v2.
- [ ] Jalankan di **local dev dulu** (bukan langsung production Neon), verifikasi angka, baru replikasi ke production.
- [ ] `npm run build` sukses & Fase 4 (testing E2E) sudah lolos — sesuai urutan asli roadmap. Kalau mau eksekusi sekarang di luar urutan, itu keputusan yang harus disadari risikonya (schema/seed berubah sebelum alur FPKB tervalidasi).

---

## Fase 3B — Schema: Kode GL

Tambah ke `Master_Barang` (satu migrasi kecil, nggak nyentuh tabel lain):

```prisma
model Master_Barang {
  // ...existing fields...
  kode_gl       String? // Kode akun GL, contoh "1442301". String (bukan Int) supaya aman dari leading-zero & gampang ditampilkan apa adanya di PDF/UI.
  keterangan_gl String? // Contoh "BARANG CETAKAN"
}
```

`kategori` (field yang sudah ada, saat ini isinya placeholder `"Migrasi Histori"` dari seed Bagian 1) akan **ditimpa** dengan kategori GL asli (`TAB`, `CEK`, `CTK`, dst) saat seed v2 — bukan field baru, field existing yang akhirnya kepakai sesuai maksud aslinya.

Command:
```
npx prisma validate
npx prisma db push
npx prisma generate
npm run build
```

Tampilkan `kode_gl` + `keterangan_gl` di `/master` dan `/master/detail/[id]` (read-only display, tidak perlu form input manual karena datanya dari seed). Opsional: tampilkan di PDF FPKB kalau nanti dibutuhkan akuntansi, tapi tidak wajib untuk Fase 3B ini.

---

## Fase 3C — `prisma/seed-buku-besar-v2.ts`

### Input
- `Buku_Besar_Update_GL_FIFO.xlsx` (taruh di root project, sama seperti pola `Database_Barang.csv`)
- Baca dengan package `xlsx` (sudah ada di `node_modules`, dipakai project lain juga)
- **Penting**: baca dengan `XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })` — pakai `raw:false` supaya tanggal (`"12-Jun-26"`) dan angka besar (`"1,442,301"`, `"1,000"`) keluar sebagai string apa adanya, bukan serial number Excel atau tipe campur. Kode GL tetap perlu di-strip koma sebelum disimpan (`String(v).replace(/,/g,'')`).

### Step 0 — Wipe (urutan penting karena FK constraint)
```
DELETE FROM "Permintaan_Header"   -- cascade ke Fpkb, Fpkb_Item, Permintaan_Detail, Permintaan_Outstanding
DELETE FROM "Mutasi_Ledger"
DELETE FROM "Item_Seri"
DELETE FROM "Batch_Barang"
DELETE FROM "Master_Barang"
```
(Lewat Prisma: `prisma.permintaan_Header.deleteMany()` dulu, baru `mutasi_Ledger`, `item_Seri`, `batch_Barang`, `master_Barang`. `Sequence_Counter` & `User` TIDAK di-wipe.)

### Step 1 — Build peta GL & konversi satuan dari sheet `Buku_Besar`
Untuk tiap SKU (ambil baris pertama kemunculan):
- `kode_gl` ← kolom `Kode GL` (strip koma, jadi string digit bersih)
- `kategori` ← kolom `Kategori GL` (CTK/TAB/CEK/dst)
- `keterangan_gl` ← kolom `Keterangan GL`
- `satuan_besar` ← kolom `Unit Stock Opname`
- `satuan` (kecil) ← kolom `Satuan`
- `isi_per_satuan_besar` ← `parseInt(kolom "Jumlah / Unit Serah Terima")` (fallback 1 kalau kosong/gagal parse)
- `minimum_order_besar` ← `parseLeadingInt(kolom "Minimum Order / Unit")` (reuse helper dari seed Bagian 1)
- **Skip** kalau SKU termasuk daftar 18 SKU yang di-skip (keputusan #4)

Upsert semua ke `Master_Barang` (kategori sebelumnya `"Migrasi Histori"` → ditimpa kategori GL asli).

### Step 2 — Batch_Barang dari sheet `Harga_FIFO_Stok_Aktif` (BUKAN dari raw Buku_Besar)
Sheet ini SUDAH rapi: 133 baris = 118 SKU dengan tingkat harga sudah dipisah per lot. Jangan reimplementasi logic merge-by-epsilon dari seed Bagian 1 — itu untuk raw CSV, di sini datanya sudah final.

Untuk tiap baris (skip yang kolom "Ada di Buku Besar" = `Tidak`, sesuai keputusan #4):
- `qty_awal = qty_sisa = "Qty Stock (satuan kecil)"`
- `harga_satuan = "Harga Satuan (Rp)"`
- `tanggal_masuk`: sheet FIFO **tidak punya kolom tanggal**. Strategi:
  1. Cari baris di `Buku_Besar` untuk SKU yang sama dengan `Harga Barang / Satuan (Rp)` mendekati (epsilon 0.5) harga tier ini → pakai `Tanggal Masuk` baris itu kalau ketemu dan valid.
  2. Kalau tidak ketemu (harga di FIFO sheet tidak match persis ke baris manapun di Buku Besar, bisa terjadi karena FIFO sheet sumbernya snapshot sistem lama, bukan manual) → fallback **tanggal snapshot sintetis**: `2026-07-01` (basis "awal Juli 2026" sesuai `Ringkasan` catatan #5), offset per `Tingkat Harga ke-` supaya urutan FIFO tetap benar: `new Date(2026-07-01T00:00:00Z).getTime() + (tingkatHargaKe - 1) * 1000`. Tingkat 1 = lot tertua (dikonsumsi FIFO duluan), konsisten sama urutan yang sudah ada di sheet.
- `nomorator_awal/akhir`: ambil dari baris Buku Besar yang match (kolom `Awal `/`Akhir`, bisa multi-baris dipisah `\n` — simpan apa adanya sebagai string), atau `'-'` kalau tidak ketemu.
- `supplier: '-'`, `status: 'AVAILABLE'`, `lokasiId`: pakai lokasi transit histori yang sama (`WMS-TRANSIT-HISTORI-01`, upsert seperti seed Bagian 1).

Tiap batch yang dibuat → langsung buat 1 `Mutasi_Ledger` INBOUND opening (`referensi: 'Saldo Awal Migrasi Buku Besar v2'`, `createdBy: 'SYSTEM_SEED_V2'`, `createdAt` = `tanggal_masuk` batch).

### Step 3 — Replay mutasi Juli 2026 (supaya `Mutasi_Ledger` nyambung ke stok terkini)
**Kenapa perlu**: `Harga_FIFO_Stok_Aktif` adalah snapshot sistem lama yang berhenti "awal Juli 2026". Mutasi setelahnya (tanggal Juli) HANYA ada di `Buku_Besar` manual dan belum tercermin di qty batch hasil Step 2. Kalau tidak di-replay, stok DB akan lebih besar dari kondisi riil sekarang.

**Filter baris yang di-replay**: dari sheet `Buku_Besar`, ambil baris dengan:
- `(Tanggal Masuk || Tanggal Keluar)` mengandung `"-Jul-"`, DAN
- `Barang Masuk > 0` ATAU `Barang Keluar > 0` (bukan baris "opening" tanpa mutasi)

Hasil analisis: **57 baris** July mutation (10 inbound, 47 outbound). Urutkan berdasarkan tanggal ascending sebelum diproses, supaya replay kronologis benar.

**Untuk tiap baris OUTBOUND** (Barang Keluar > 0):
- Ambil semua batch SKU ini `WHERE qty_sisa > 0 AND status = AVAILABLE ORDER BY tanggal_masuk ASC` (pola identik `prosesAdjustmentFpkb` di `src/app/fpkb/actions.ts:61-65`)
- Potong FIFO dari batch tertua, spillover ke batch berikutnya kalau kurang (sama seperti fungsi itu)
- `Mutasi_Ledger`: `tipe_mutasi: OUTBOUND`, `qty_perubahan: -barangKeluar`, `referensi: Nomor Dokumen || No FPKB` (ini yang bawa nomor FPP asli seperti `150/FPP/LOG/2026`), `keterangan`: gabungan `Nama Cabang/Unit Kerja` + `PIC Cabang/Unit Kerja`, `createdBy: Petugas Gudang || 'SYSTEM_SEED_V2'`, `createdAt`: tanggal Juli asli dari baris ini (bukan sintetis).

**Untuk tiap baris INBOUND** (Barang Masuk > 0):
- Cek harga baris ini vs batch existing termuda SKU tsb (epsilon 0.5):
  - Kalau harga **sama** → tambah qty ke batch itu (`qty_sisa += barangMasuk`, `qty_awal += barangMasuk`)
  - Kalau harga **beda** → buat batch/lot baru dengan `tanggal_masuk` = tanggal Juli asli baris ini, harga dari baris ini
- `Mutasi_Ledger`: `tipe_mutasi: INBOUND`, `qty_perubahan: +barangMasuk`, `referensi: Nomor Dokumen`, `createdAt`: tanggal Juli asli.

**Catatan IDSS-712**: kalau precondition (perbaikan sel `' 4 '` di Excel) belum dilakukan pas eksekusi, script harus **skip baris ini dengan warning log** (jangan asumsi tanggal), supaya tidak salah catat tanggal mutasi. Lebih aman gagal eksplisit daripada nebak.

### Step 4 — Rekonsiliasi pasca-seed (WAJIB, sebelum dianggap selesai)
- Total nilai stok (`SUM(qty_sisa * harga_satuan)` across semua batch AVAILABLE) harus ≈ **Rp 982.691.570,50 dikurangi net outflow Juli** (hitung: total value baris OUTBOUND Juli dikurangi total value baris INBOUND Juli, pakai harga masing-masing baris).
- Spot-check manual 3-5 SKU (disarankan: `IDSS-508` yang punya 3 tingkat harga, `IDSS-712` yang perlu perbaikan tanggal, dan 1 SKU dengan konversi satuan besar seperti `IDSS-179` 1 Pack = 1.000 Lembar) — bandingkan qty & harga di `/inventory` vs Buku Besar manual.
- Cross-check jumlah SKU: harus 118 (dikurangi yang skip Step 1 kalau ada perbedaan lagi dengan Harga_FIFO sheet).

---

## Risiko & Catatan Terbuka
1. **`IDSS-302` tidak punya harga sama sekali** di Buku Besar (kolom "Harga Barang / Satuan" kosong) dan tidak muncul di sheet `Harga_FIFO_Stok_Aktif` (barang baru, belum pernah ada batch harga). Master_Barang tetap dibuat (Step 1), tapi **tidak akan ada Batch_Barang untuknya** dari Step 2 — kalau qty stock opname-nya (1 Pack) perlu direpresentasikan sebagai stok riil, perlu keputusan tambahan: buat batch manual dengan harga placeholder 0, atau biarkan qty=0 sampai ada inbound resmi via `/inbound`. **Rekomendasi: biarkan 0 dulu**, barang baru masuk stok pas ada inbound resmi lewat website (lebih sesuai semangat Bagian 3: mulai operasional penuh via web).
2. **Kolom `Awal `/`Akhir` (nomorator) bisa multi-baris** (dipisah `\n`, contoh ditemukan di `IDSS-119`: `"419501\n412001"`). `nomorator_awal`/`nomorator_akhir` di schema adalah `String?` biasa, jadi aman disimpan apa adanya termasuk newline-nya — cuma perlu diperhatikan kalau nanti ditampilkan di PDF/UI (mungkin perlu `white-space: pre-line`).
3. Field `kategori` yang lama (`"Migrasi Histori"`) akan hilang total setelah seed v2 — pastikan tidak ada kode lain yang bergantung ke string itu spesifik (quick grep sebelum eksekusi: `grep -rn "Migrasi Histori" src/`).
4. Karena wipe menghapus semua `Permintaan_Header`, **hasil testing Fase 4 (S1-S7) akan ikut hilang**. Kalau mau menyimpan bukti testing sudah lolos, screenshot/export dulu sebelum run seed v2 — jangan jadikan wipe sebagai alasan untuk skip Fase 4.

---

## Urutan Eksekusi yang Disarankan
1. Selesaikan Fase 4 (testing E2E S1-S7) dulu — validasi alur FPKB jalan dengan data test apa adanya.
2. Perbaiki sel `IDSS-712` di Excel.
3. Fase 3B: tambah `kode_gl` + `keterangan_gl`, `db push`, `build`.
4. Fase 3C: tulis & jalankan `seed-buku-besar-v2.ts` di **local dev** dulu, jalankan Step 4 rekonsiliasi.
5. Kalau angka cocok → jalankan ulang di production Neon.
6. Verifikasi visual `/inventory` & `/master`.
