# INSTRUKSI — SEED v2.1 (Revisi Basis: Buku Besar = Otoritas Qty)

> Untuk Claude Code. Revisi atas `seed-buku-besar-v2.ts` berdasarkan cross-check sesi chat 20 Jul 2026 terhadap laporan seed v2 (`f2f8d73`).

## Hasil cross-check yang mendasari revisi ini (sudah diverifikasi dengan data)
1. Kedua bug fix kamu (running-balance & satuan besar) VALID — dipertahankan. Verifikasi independen: 97% baris konsisten satuan besar, 0% satuan kecil.
2. Gap total -Rp 123,56 jt ≈ nilai 18 SKU sistem-only yang di-skip (Rp 123,30 jt) — bukan bug.
3. Akar 95 selisih per-SKU: snapshot sistem hanya cocok dengan posisi Buku Besar akhir Juni untuk 18/112 SKU. Buku Besar dimulai 7 Jun 2026 dari stock opname fisik ("Stock Awal"), sedangkan sistem sudah lama melenceng dari kondisi fisik. **Keputusan arsitektur data (final): Buku Besar = otoritas QTY. Sistem = otoritas HARGA (tier FIFO) & Kode GL saja.**

## Perubahan logika seed (v2 → v2.1)

### A. Opening balance per SKU: dari Buku Besar, bukan snapshot sistem
- Opening qty = `Stock Awal` baris pertama SKU (satuan besar) × `isi_per_satuan_besar` → satuan kecil.
- `tanggal_masuk` opening = **2026-06-01** (sebelum mutasi pertama 7 Jun), referensi `"OPENING - Stock Opname Jun 2026"`.

### B. Harga opening: alokasikan qty opening ke tier harga sistem
Untuk tiap SKU, ambil tier harga dari sheet `Harga_FIFO_Stok_Aktif` (urut `Tingkat Harga ke-`), lalu alokasikan qty opening ke tier **dari tier 1 (tertua) ke atas**, cap di qty masing-masing tier:
- Satu tier terpakai = satu row `Batch_Barang` (harga tier, qty teralokasi).
- **Kelebihan** qty opening di atas total semua tier → satu batch tambahan pakai `Harga Barang / Satuan (Rp)` dari Buku Besar SKU itu, referensi ditandai `"[HARGA DARI BUKU BESAR]"`.
- SKU **tanpa tier sama sekali** (12 SKU: IDSS-003, IDSS-004, IDSS-104, IDSS-127, IDSS-212, IDSS-302, IDSS-505, IDSS-702, IDSS-929, PRO-124, PRO-143, PRO-144) → seluruh opening pakai harga Buku Besar. Kalau harga Buku Besar juga kosong → batch harga 0 + WARNING keras di laporan (harga wajib diisi Staf via /master sebelum SKU itu dipakai di FPKB).
- Catat di komentar script: alokasi harga ini APROKSIMASI yang disadari (tier snapshot = kondisi awal Juli, opening = awal Juni; fidelity sempurna tidak mungkin, qty tetap eksak).

### C. Replay SEMUA mutasi (7 Jun – 16 Jul), bukan hanya Juli
- Urut tanggal ascending, konversi satuan besar → kecil (fix kamu dipertahankan), OUTBOUND potong FIFO seperti sebelumnya, nomor dokumen asli → `referensi`.
- Baris **tanpa tanggal valid** (IDSS-712 sel `' 4 '`, PRO-001, dst): JANGAN skip lagi — qty-nya dibutuhkan supaya saldo akhir match. Pakai tanggal fallback = tanggal baris valid sebelumnya di SKU yang sama (atau 2026-07-01 kalau tidak ada), tambahkan `"[TANGGAL TIDAK TERCATAT DI SUMBER]"` di referensi + masuk daftar warning.
- PRO-124/PRO-144 yang kemarin gagal (0 batch tersedia) otomatis beres karena opening-nya sekarang dari Buku Besar.

### D. Rekonsiliasi: sekarang HARD-FAIL
- Per-SKU: `SUM(qty_sisa)` di DB harus == running-balance final Buku Besar × isi, **selisih 0 untuk SEMUA 112 SKU** (by construction harusnya pasti; kalau ada ≠ 0 berarti bug script → fail, jangan lanjut).
- Ekspektasi pembanding: total stok final ± 1.594.059 unit kecil, 109 SKU ber-stok > 0.
- Total nilai akhir: dihitung & di-print (target baru, bukan Rp 982 jt lagi — itu basis lama). Simpan angkanya di laporan untuk arsip.

### E. Tidak berubah dari v2
Wipe order, upsert Master + kode_gl/keterangan_gl, skip 18 SKU sistem-only, Sequence_Counter tidak disentuh, hanya DATABASE_URL lokal, scope file ketat.

## Jalankan & laporkan
```bash
npm run seed:v2 && npm run build
```
Laporan balik: (1) rekonsiliasi per-SKU (harus 0 semua / 112), (2) total nilai akhir, (3) jumlah batch per sumber harga (tier sistem / harga BB / harga 0), (4) daftar warning tanggal-fallback & harga-0, (5) spot-check IDSS-179 (final harus = running balance BB × 1000), IDSS-508, IDSS-929 (sekarang harus ber-stok, kemarin 0).

Commit: `fix(seed): basis qty pindah ke buku besar, sistem hanya untuk harga & GL (seed v2.1)`
