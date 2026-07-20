# Roadmap & Context — WMS BCAS v2

> **Dokumen ini didesain buat jadi starting point sesi chat baru.** Kalau kamu Claude yang baca ini di percakapan baru: baca seluruh bagian "Context Project" dulu sebelum bantu apa-apa, karena banyak keputusan desain yang nggak obvious dari kode doang.

Repo: `https://github.com/evelotion/wms-bcas-v2`
Terakhir diupdate: 20 Jul 2026

---

# 📋 Context Project (baca ini dulu kalau sesi baru)

## Apa ini
WMS (Warehouse Management System) internal buat BCA Syariah, dipakai tim gudang & logistik cetakan (buku cek, formulir, dll). Next.js 14 + Prisma + Neon (Postgres serverless) + Vercel. Third-party/internal — belum resmi dipakai cabang langsung, jadi beberapa alur (misal FPP dari Cabang) masih manual via email PDF.

## Siapa yang ngobrol
User = **Staf** logistik (role `ADMIN` di sistem), posisinya di atas **Admin Gudang** (role `GUDANG`). Nggak ada role Cabang di sistem — Cabang kirim request via email PDF (form FPP), bukan lewat website.

## 3 pekerjaan besar

### 1. Migrasi data stok histori dari CSV manual ke database (SELESAI)
Database gudang sebelumnya cuma spreadsheet CSV berbentuk ledger transaksi (bukan snapshot). Udah diaudit, dibersihin, dan di-import lewat script `prisma/seed-histori-barang.ts`. Termasuk nambah konversi satuan kemasan (`satuan_besar`, `isi_per_satuan_besar`, `minimum_order_besar`) di `Master_Barang`.

### 2. Alur FPP → FPKB → Outstanding (KODE SELESAI, TESTING BELUM)
Alur bisnis LENGKAP (final, udah disepakati):

```
Cabang kirim FPP via email PDF (manual, di luar sistem)
  → Staf input ke website → sistem AUTO-GENERATE nomor FPKB (FPP "murni jadi" FPKB)
  → FPKB masuk ke antrean Admin Gudang
  → Admin Gudang cek stok & isi REALISASI per item (bisa kurang dari yang diminta)
  → Barang yang nggak kekejar stoknya → jadi Outstanding
    (tetap ke-link ke FPP & FPKB asal - kayak tiket, nggak "close" sampai:
     (a) diproses ulang jadi FPKB BARU dengan nomor baru pas restock, atau
     (b) Staf yang reject/tutup permanen - ini keputusan Staf, BUKAN Admin Gudang)
  → Serah terima barang, beda jalur per wilayah:
    - JABODETABEK: cukup FPKB (dgn kolom Realisasi) ditandatangan + diupload
    - NON-JABODETABEK: FPKB + BAST (auto-generate dari data realisasi) + nomor
      Airwaybill/resi, dua-duanya ditandatangan + diupload
  → Dashboard Admin Gudang ada alert kalau ada FPKB yang statusnya "sudah
    diproses stok tapi dokumen serah terima belum lengkap"
  → Dashboard Staf & Admin Gudang ada alert kalau ada Outstanding yang
    sekarang stoknya udah cukup (abis restock) - saran buat diproses ulang
```

### 3. Aktivasi Operasional — Buku Besar pindah ke Website (BARU, 20 Jul 2026)
**Goal:** mulai hari ini s/d maksimal 20 Agu 2026, Staf berhenti nyatet keluar/masuk barang di Excel dan sepenuhnya operasional lewat website: input barang masuk (inbound), keluar (FPKB), dan **penarikan data stock opname** langsung dari website. Excel jadi arsip, bukan alat kerja harian.

**Sumber datanya:** file `Buku_Besar_Update_GL_FIFO.xlsx` (dibuat 20 Jul 2026 di sesi chat) — gabungan dari:
- `Buku_Besar.csv` = pencatatan manual Staf, PALING UPDATE (mutasi sampai Juli 2026, termasuk nomor FPP asli kayak `104/FPP/LOG/2026`)
- `Persediaan_Gabungan_GL_Qty.xlsx` = snapshot sistem lama (berhenti awal Juli 2026, SUDAH TIDAK DIPAKAI lagi), sumber Kode GL + pecahan harga FIFO

Isi file gabungan (3 sheet):
- `Buku_Besar`: 349 baris ledger manual + Kode GL lengkap 349/349 + Kategori GL + Keterangan GL + Sumber GL
- `Harga_FIFO_Stok_Aktif`: 133 baris harga ber-stok > 0 (118 SKU), 14 SKU multi-harga (total 29 baris) SUDAH DIPISAH per tingkat harga — total nilai Rp 982.691.570,50 (basis snapshot sistem, satuan kecil)
- `Ringkasan`: rekap per GL + catatan metodologi

## Keputusan arsitektur penting (biar nggak ke-desain ulang tanpa sadar)

1. **1 FPP bisa punya BANYAK FPKB.** `Permintaan_Header` (representasi FPP) → punya relasi `fpkbs: Fpkb[]`. Tiap outstanding diproses ulang = FPKB baru (nomor baru), bukan update FPKB lama.
2. **Role mapping:** `ADMIN` di database = **Staf**. `GUDANG` = **Admin Gudang**. Relabel di UI (`src/components/layout/ClientAppShell.tsx`), nggak ada role baru.
3. **Penomoran sementara mulai dari `1`** (bukan format resmi `070/FPP/LOG/2026`). Ada di `src/lib/sequence.ts`, gampang diganti formatnya nanti. ⚠️ Catatan baru: Buku Besar manual PUNYA nomor FPP resmi (`104/FPP/LOG/2026`) — pas migrasi histori, nomor asli disimpan sebagai referensi teks, JANGAN ganggu sequence counter.
4. **Nama-nama orang (signer FPKB/BAST) dikosongin dulu** — nullable, di PDF jadi garis titik-titik.
5. **Harga di FPKB itu snapshot, bukan live.** `Fpkb_Item.harga_satuan` diambil dari batch FIFO tertua PAS FPKB dibuat (`src/lib/pricing.ts`), disimpen permanen.
6. **FIFO udah otomatis** — `prosesAdjustmentFpkb` motong stok dari batch `tanggal_masuk` paling lama duluan.
7. **(BARU) Kode GL nempel di level SKU, bukan level batch.** Satu SKU = satu GL, konsisten 100% (diverifikasi dari 346 baris Buku Besar vs sistem, nol konflik). Kamus GL final:
   | Kategori | Keterangan | GL |
   |---|---|---|
   | TAB | Buku Tabungan | 1442102 |
   | DEP | Bilyet Deposito | 1442103 |
   | CEK | Buku Cek & Bilyet Giro | 1442105 |
   | MTR | Materai - Perangko | 1442202 |
   | CTK | Barang Cetakan | 1442301 |
   | ATK | Alat Tulis Kantor | 1442302 |
   | PRO | Barang Promosi | 1442303 |
   | LL2 | Persediaan Barang Lainnya | 1442304 |
   | ATF | Kartu Flazz BCAS | 1442305 |
8. **(BARU) Satuan di database = satuan KECIL (atomic).** Sistem lama nyatet satuan kecil (lembar/set/pcs), Buku Besar manual nyatet satuan besar (pack/box). Semua qty yang masuk DB harus dikonversi ke satuan kecil pakai `isi_per_satuan_besar`. Jangan pernah campur.

## Cara kerja sesi ini (penting buat dipahami)
User punya **Claude Pro di VS Code (Claude Code)** yang jalan paralel buat eksekusi kode langsung ke repo. Sesi chat (claude.ai) dipakai buat desain/planning/review, BUKAN eksekusi — Claude chat cuma bisa baca repo (via `codeload.github.com`). Pola kerja established:
1. Didesain & diverifikasi dulu di sandbox chat
2. Dikemas jadi instruksi/spec buat Claude Code
3. User jalanin di VS Code, push ke GitHub
4. Cross-check lagi ke chat dengan kasih link repo

---

# ✅ Bagian 1 — Migrasi Data Histori (CSV → Database) — SELESAI TOTAL

- [x] Fix Vercel build error, audit & bersihin `Database_Barang.csv` (16 anomali)
- [x] Schema konversi satuan di `Master_Barang`, seed `prisma/seed-histori-barang.ts` (multi-batch FIFO-ready)
- [x] Migrasi dijalankan, diverifikasi, deploy sukses

# 🔄 Bagian 2 — Alur FPP → FPKB → Outstanding

## ✅ Fase 1–2.6 (SELESAI & TERVERIFIKASI 2x dari GitHub)
Schema (`Fpkb`, `Fpkb_Item`, `Sequence_Counter`, enum status/wilayah), 5 file actions, PDF generator FPKB+BAST, halaman permintaan/fpkb/outstanding, alert dashboard, role relabel, snapshot harga FIFO + konversi pack di `printFpkb`.

## ✅ Fase 3 — Migrasi Database (SELESAI 20 Jul 2026)
`prisma validate` → `db push` (sync ke Neon 8.86s, tanpa prompt data-loss) → `generate` → `npm run build` COMPILED SUCCESSFULLY. Schema live di Neon, route `/fpkb` `/outstanding` `/permintaan` ke-build semua.

## 🔲 Fase 4 — Testing Alur End-to-End (BELUM — INI PRIORITAS BERIKUTNYA)
Jalanin berurutan di local (`npm run dev`):
- [ ] **S1 Happy path JABODETABEK**: input FPP (Staf) → nomor auto → realisasi full (Admin Gudang) → stok kepotong FIFO → PDF harga muncul → upload FPKB signed → `SELESAI` tanpa BAST
- [ ] **S2 Outstanding**: qty > stok → realisasi sebagian → sisa masuk `/outstanding` dgn link FPP+FPKB asal
- [ ] **S3 Reissue**: restock via `/inbound` → alert dashboard muncul → proses ulang → FPKB BARU nomor baru, tetap link ke FPP sama
- [ ] **S4 Tutup outstanding**: hanya Staf yang bisa; FPP jadi `CLOSED` kalau nggak ada outstanding lain
- [ ] **S5 NON-JABODETABEK**: wajib Airwaybill + BAST auto-generate; submit tanpa Airwaybill harus ditolak
- [ ] **S6 Alert serah terima nunggak** muncul di dashboard Admin Gudang
- [ ] **S7 Snapshot harga**: inbound harga baru → FPKB lama tetap harga lama
- [ ] Sebelum mulai: cek `/master` — pastikan data histori Bagian 1 masih utuh di Neon

## 🔲 Fase 5 — Deploy Final
- [ ] Commit, push, Vercel build sukses di production

## 📦 Side-quest: Redesign /inventory (SPEC SIAP, BELUM DIEKSEKUSI)
File `InventoryClient.tsx` (drop-in replacement) + `INSTRUKSI_CLAUDE_CODE.md` udah dibuat di sesi chat 20 Jul: KPI strip, status 3-tier (Kritis/Menipis 1.5x/Aman), filter chips, sorting, kategori & tanggal masuk ditampilin, expanded row jadi "Antrean FIFO" dgn badge "Keluar berikutnya" + umur hari.
- [ ] Eksekusi via Claude Code, push, cross-check

---

# 🆕 Bagian 3 — Aktivasi Operasional (Buku Besar → Website)

**Target: operasional penuh maksimal 20 Agu 2026.** Urutannya SETELAH Fase 4 Bagian 2 lolos, karena percuma seed data produksi kalau alur keluar-barangnya belum terbukti jalan.

## Fase 3A — Konfirmasi Keputusan Data (DISKUSI, sebelum koding)
Pertanyaan yang HARUS dijawab Staf dulu (jangan diasumsikan):
- [ ] **Hubungan `Database_Barang.csv` (Bagian 1, udah di Neon) vs `Buku_Besar.csv` (baru)**: apakah Buku Besar ini versi lebih baru dari ledger yang sama? Kalau ya → strategi seed v2 = WIPE & re-import bersih dari file gabungan (paling aman, belum ada data produksi FPKB), atau MERGE delta doang? Rekomendasi: wipe & re-import, tapi keputusan di Staf.
- [ ] **GL untuk `IDSS-302` & `IDSS-505`** (di file ditandai kuning): usulan CTK/1442301 — konfirmasi.
- [ ] **1 sel tanggal `IDSS-712`** yang isinya cuma `' 4 '` — dilengkapi manual di Excel dulu.
- [ ] **18 SKU ber-stok di sistem tapi nggak ada di Buku Besar** (kolom "Ada di Buku Besar" = Tidak di sheet FIFO): ikut di-seed atau memang udah nggak relevan?
- [ ] **Mapping konversi satuan per SKU**: `isi_per_satuan_besar` harus keisi bener buat semua SKU yang Buku Besar-nya nyatet pack/box (contoh IDSS-179: 1 pack = 1.000 lembar). Sumber: kolom "Jumlah / Unit Serah Terima" di Buku Besar.

## Fase 3B — Schema: Kode GL
- [ ] Tambah `kode_gl String?` (atau `Int?`) + `keterangan_gl String?` di `Master_Barang` — SATU migrasi kecil, nggak nyentuh tabel lain
- [ ] Tampilkan GL di `/master`, `/master/detail/[id]`, dan (opsional) di PDF FPKB
- [ ] `db push` + build

## Fase 3C — Seed v2 dari File Gabungan
- [ ] Script `prisma/seed-buku-besar-v2.ts`: baca `Buku_Besar_Update_GL_FIFO.xlsx` →
  - Master_Barang: upsert by SKU + isi `kode_gl`/`kategori` dari sheet Buku_Besar
  - Batch_Barang: buat batch per baris sheet `Harga_FIFO_Stok_Aktif` (qty satuan kecil + harga masing-masing — JANGAN dirata-rata), `tanggal_masuk` pakai tanggal dari Buku Besar kalau ketemu, fallback tanggal snapshot
  - Mutasi Juli (dari Buku Besar) di-replay biar `Mutasi_Ledger` nyambung — nomor FPP asli (`104/FPP/LOG/2026`) masuk kolom `referensi`
- [ ] Rekonsiliasi pasca-seed: total nilai stok DB harus ≈ Rp 982,69 jt minus mutasi keluar Juli (angka pasti dihitung pas seed)
- [ ] Verifikasi visual di `/inventory` (bonus: redesign-nya udah nampilin harga per batch)

## Fase 3D — Fitur Penarikan Stock Opname
Halaman `/laporan` udah ada (persediaan + masuk + keluar per bulan), tapi formatnya belum format Buku Besar. Tambahan:
- [ ] Laporan "Stock Opname" format kolom Buku Besar (SKU, nama, qty per satuan besar & kecil, harga per batch, nilai, Kode GL) — biar hasil tarikan website bisa langsung menggantikan Excel
- [ ] Tombol export ke Excel/CSV dari `/laporan`
- [ ] Subtotal per Kode GL (kebutuhan akuntansi)

## Fase 3E — Cutover Operasional
- [ ] Tanggal cutover disepakati (misal 1 Agu 2026): mulai tanggal itu SEMUA inbound & FPKB via website
- [ ] Excel di-freeze sebagai arsip per tanggal cutover
- [ ] Minggu pertama: jalan paralel ringan (website utama, Excel cadangan) — kalau seminggu bersih, Excel pensiun
- [ ] Stock opname pertama full dari website akhir Agustus

---

# 🎯 RINGKASAN: Kita Sekarang di Mana & Next Apa

**Status per 20 Jul 2026:**
- Bagian 1 kelar total. 
- Bagian 2: kode selesai & terverifikasi 2x, **Fase 3 (db push + build) SELESAI hari ini** — tinggal Fase 4 (testing) & Fase 5 (deploy).
- Side-quest redesign /inventory: spec + file siap, belum dieksekusi Claude Code.
- Bagian 3 (baru): file seed `Buku_Besar_Update_GL_FIFO.xlsx` udah jadi & terverifikasi angkanya. Fase-fasenya udah terdefinisi, nunggu Fase 4 Bagian 2 lolos dulu.

**Urutan kerja berikutnya:**
1. **Fase 4 Bagian 2** — testing end-to-end S1–S7 (blocker semua hal lain)
2. Eksekusi redesign /inventory via Claude Code (bisa disisipkan kapan aja)
3. **Fase 3A** — jawab 5 pertanyaan konfirmasi data
4. Fase 3B → 3C → 3D berurutan (schema GL → seed v2 → laporan stock opname)
5. Fase 5 deploy + Fase 3E cutover — target operasional penuh sebelum 20 Agu 2026

**Kalau mulai chat baru:** paste dokumen ini + bilang mau lanjut dari mana. Kalau udah ada progress testing/eksekusi, kasih link repo buat cross-check.
