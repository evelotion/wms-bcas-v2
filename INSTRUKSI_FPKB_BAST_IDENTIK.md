# INSTRUKSI — FPKB & BAST identik contoh (HTML print-to-PDF) + No FPP manual + Download

> **Konteks:** Ganti generator PDF FPKB & BAST dari jsPDF (koordinat manual) ke **HTML+CSS print-to-PDF** supaya bisa **identik** dengan contoh cetakan BCA Syariah. Template HTML FPKB sudah dibuat & di-render sebagai prototipe teruji — lihat file `PROTOTIPE_FPKB.html` (+ `PROTOTIPE_FPKB_render.pdf` untuk target visual). Sekalian: **No FPP jadi manual input** (nomor dari cabang, bukan auto), kolom **Realisasi kosong** sampai Admin Gudang adjustment, dan tombol **Download** FPKB dari alur. Setelah `npm run build` lolos → commit → push → lapor.

Repo: `evelotion/wms-bcas-v2` · Next.js 14.2. **Logo BCA Syariah asli sudah tersedia** (`logo-bca-syariah.png`, 268×60, transparan) — sudah terpasang di `PROTOTIPE_FPKB.html` (di-render & terverifikasi proporsinya pas). **Taruh logo di `public/logo-bca-syariah.png`** lalu referensikan `<img src="/logo-bca-syariah.png" style="height:11mm;width:auto">` di komponen print (lebih rapi daripada base64 inline).

---

## Pendekatan: HTML print-to-PDF (bukan jsPDF lagi)

**Cara paling sederhana & tanpa dependency berat:** render markup FPKB/BAST sebagai HTML di route/komponen khusus, lalu panggil `window.print()` dengan `@media print` CSS (A4). User "Save as PDF" dari dialog print browser, atau kita sediakan tombol yang membuka tab print. Ini menghindari dependency HTML-to-PDF server-side dan memberi **preview real-time** di browser.

Alternatif kalau mau file PDF langsung ter-download tanpa dialog: pakai library HTML-to-canvas-to-PDF (mis. `html2pdf.js`). **Tapi mulai dari `window.print()` dulu** — paling identik & paling ringan. Diskusikan dengan user kalau mau auto-download.

### Implementasi disarankan
1. Buat komponen React `FpkbPrintView` & `BastPrintView` (di `src/components/print/`) yang menerima props data dan me-render markup persis `PROTOTIPE_FPKB.html`.
2. Buat route `/fpkb/print/[id]` (dan `/bast/print/[id]`) yang: fetch data FPKB by id (server), render `FpkbPrintView`, dan otomatis trigger `window.print()` on mount (atau tombol "Cetak / Simpan PDF").
3. Global CSS `@media print { ... }`: sembunyikan navbar/sidebar, set `@page { size: A4; margin: 12mm; }`, warna hitam, tabel border tegas.
4. Tombol **"Download / Cetak FPKB"** di `/fpkb` (menggantikan pemanggilan `generateFPKB` lama) → buka route print di tab baru.

---

## Template HTML FPKB (SUDAH TERUJI — pakai ini persis)

File `PROTOTIPE_FPKB.html` berisi markup + CSS lengkap yang sudah di-render dan cocok dengan contoh. Konversi ke JSX `FpkbPrintView`. Struktur (urut):
1. **Kop**: logo BCA Syariah asli via `<img src="/logo-bca-syariah.png" style="height:11mm;width:auto">` (file taruh di `public/`). Sudah terpasang & terverifikasi di prototipe.
2. **Judul**: "FORM PERSETUJUAN KELUAR BARANG" + "No. {nomorFpkb}".
3. **A. INFORMASI PERMINTAAN\*** — 2 kolom, tiap value bergaris bawah:
   - Kiri: Media Request (FPP), No Dokumen (**= noFpp, manual**), Tgl Dokumen, Cabang/Unit Kerja
   - Kanan: Tgl Request, PIC Unit Kerja, Jenis Permintaan (Existing), Ketersediaan ([ V ] Ada [ ] Tidak Ada)
4. **B. DETAIL PERSETUJUAN BARANG\*** — tabel, header abu-abu (`#e8e8e8`), kolom: No. / Kode Barang / Nama Barang / Jml Pack / Jml Satuan / Harga Satuan / Total / **Realisasi Pengiriman** / Keterangan. Baris terakhir Grand Total (bold, colspan ke kolom Total).
   - **Kolom "Realisasi Pengiriman" DIKOSONGKAN** kalau FPKB belum adjustment (mirror contoh FPKB_1 & ketentuan). Isi hanya kalau `qty_realisasi` sudah ada.
5. **Blok tanda tangan approval** (3 kotak): Dibuat (Staf) / Diverifikasi (SPV Logistik) / Disetujui (Ka Bid/Dept Logistik). Nama = titik-titik kalau kosong.
6. **C. INSTALASI & SETUP** (4 kotak): Menyerahkan\*(Logistik) / Diterima\*\*(IT Support) / Diserahkan\*\*(IT) / Diterima\*(Logistik). + "Catatan IT :".
7. **D. PENGELUARAN & SERAH TERIMA BARANG** (4 kotak): Diserahkan(Logistik) / Diterima(User) / Diterima(Ka Dept/Ka Satuan Kerja) / Diterima(Ekspedisi/Kurir Eksternal). + "No. BAST : ...  No. AIRWAYBILL : ...".
8. **Ketentuan** (teks lengkap dari contoh, ada di prototipe).

**Data → template mapping** (dari `fpkb/page.tsx` payload yang sudah ada):
- `nomorFpkb` ← `fpkb.nomor_fpkb`
- `noFpp` ← `fpkb.header.nomor_fpp` (sekarang jadi manual, lihat bawah)
- `cabang` ← `fpkb.header.cabang`, `pic` ← `fpkb.header.pic_nama`
- `tglDokumen`/`tglRequest` ← `fpkb.createdAt` (atau tanggal dokumen manual kalau ada)
- items: `kode`←sku, `nama`←nama, `jmlPack`←qty besar, `jmlSatuan`←`${qtyKecil} ${satuan}`, `hargaSatuan`, `total`, realisasi (kosong/terisi), keterangan
- `grandTotal` ← sum total

---

## BAST — identik contoh `Contoh_BAST_Cetakan.pdf`

Buat `BastPrintView` mirip, struktur dari contoh BAST:
1. Kop logo + judul "BERITA ACARA SERAH TERIMA BARANG" + "No. {nomorBast}".
2. **A. INFORMASI PENERIMA** — 2 kolom bergaris bawah: Nama / No Dokumen & Tanggal (= noFpkb) / Perihal (Barang Cetakan) ; Tgl Dokumen Diterima / Cabang/Unit Kerja / Jenis Aset (Non Aktiva).
3. **B. DETAIL BARANG YANG DISERAHKAN** — tabel: No / Kode Barang / Nama Barang / Qty / Unit / Spesifikasi / Keterangan. (Qty = realisasi.)
4. **C. PERNYATAAN PENERIMA** — teks: "Saya bertanggung jawab atas barang yang diterima, dan memastikan barang sudah dicheck dan diterima dalam keadaan baik."
5. **D. SERAH TERIMA BARANG** — 2 kotak besar: Menyerahkan (nama petugas gudang + "Staff Gudang") / Menerima (nama penerima + jabatan). Tgl di atas tiap kotak.

Mapping dari payload `generateBAST` yang sudah ada (`nomorBast`, `noDokumenFpkb`, `cabang`, items{kode,nama,qty,unit,keterangan}).

---

## Perubahan tambahan (di luar PDF)

### No FPP jadi MANUAL input
Saat ini `createFppBaru` di `permintaan/actions.ts:38` pakai `getNextSequenceNumber("FPP")` (auto). **Ubah** supaya No FPP di-input manual oleh Staf (nomor asli dari cabang, mis. `104/FPP/LOG/2026`):
- Tambah field input "No FPP (dari cabang)" di form `/permintaan` (`page.tsx`), wajib diisi.
- `createFppBaru` terima `nomorFpp` dari argumen, bukan generate. **Hapus** `getNextSequenceNumber("FPP")` di jalur ini (tetap pakai auto untuk **FPKB** — itu nomor internal sistem).
- Validasi: tolak kalau kosong. Boleh cek duplikat (opsional).
- Simpan ke `header.nomor_fpp` seperti biasa.
> **Catatan konsistensi:** ini sejalan dengan keputusan arsitektur — nomor FPP resmi historis disimpan sebagai teks referensi. FPKB tetap auto (nomor internal). Jangan ubah penomoran FPKB.

### Tombol Download/Cetak
- Di `/fpkb` (dan/atau setelah buat FPP sukses di `/permintaan`), tombol "Cetak / Download FPKB" → buka `/fpkb/print/[id]`.
- BAST: tombol muncul hanya kalau `wilayah === NON_JABODETABEK` & `nomor_bast` ada.

---

## Aturan
- Simpan `generateFpkb.ts`/`generateBast.ts` lama untuk sementara (jangan hapus dulu) sampai versi HTML terverifikasi user, biar bisa rollback. Setelah user konfirmasi identik, file jsPDF lama boleh dihapus.
- Jangan ubah logika bisnis (FIFO, adjustment, status). Ini murni presentasi + input No FPP.
- No FPP manual: jangan sampai memecah jalur reissue outstanding (yang tidak punya input form) — beri fallback/validasi.
- `npm run build` wajib lolos.

## Laporan balik (cross-check)
- File dibuat/diubah; konfirmasi route print + komponen view.
- Konfirmasi No FPP sekarang manual & FPKB tetap auto.
- Konfirmasi realisasi kosong sampai adjustment.
- Sebutkan pakai `window.print()` atau library — dan kalau ada dependency baru.

## Verifikasi mata user di browser
- Buka `/fpkb/print/[id]` → layout **identik** `PROTOTIPE_FPKB_render.pdf` / contoh asli (kop, section A garis bawah, tabel header abu-abu + Realisasi Pengiriman, 3 blok ttd, Instalasi IT 4-kotak, section D 4-kotak, Ketentuan).
- Realisasi kosong sebelum adjustment; terisi setelah Admin Gudang proses.
- `/permintaan`: field No FPP manual muncul & wajib; FPKB tetap auto.
- BAST print (NON_JABODETABEK) identik contoh BAST.
- Cek print A4: tidak terpotong, 1-2 halaman rapi.
