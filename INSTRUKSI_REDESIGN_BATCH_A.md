# INSTRUKSI REDESIGN — BATCH A (Alignment Halaman Kerja Inti)

> Untuk Claude Code. Redesign 4 halaman inti supaya sistem visualnya konsisten dengan `/inventory` (yang sudah di-redesign di commit `5a59a00`) dan `/` Dashboard (yang sudah premium). Kerjaan ini SEBELUM testing Fase 4, biar lo testing satu kali di UI final.

## Prinsip desain (WAJIB dipatuhi semua halaman)
Gaya visual acuan = `src/app/inventory/InventoryClient.tsx`. Jangan reka-reka gaya baru — lift pola yang sudah ada di sana:

- **Panel**: `glass-panel rounded-2xl` untuk semua card/section
- **KPI strip** (kalau relevan): 4 kartu `grid grid-cols-2 lg:grid-cols-4 gap-4`, icon di kotak `w-11 h-11 rounded-xl bg-{color}-50 border border-{color}-100`, angka `text-2xl font-black text-slate-800`, label `text-xs font-semibold text-slate-500 uppercase tracking-wide`
- **Filter chips**: pattern `p-1 bg-slate-100/80 rounded-xl border border-slate-200/60` berisi tombol yang aktif = `bg-white text-blue-700 shadow-sm border border-slate-200`, tidak aktif = `text-slate-500 hover:text-slate-700`
- **Search input**: `pl-11 bg-white/70 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50`, icon Search di dalam
- **Tabel header**: `bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider`
- **Baris tabel**: `hover:bg-white/60 hover:shadow-sm transition-all` + `divide-y divide-slate-100/60`
- **Badge status**: pill `px-3 py-1 rounded-full text-xs font-bold border` + dot 1.5px, warna ikuti KONDISI_CONFIG di InventoryClient
- **Empty state**: icon 12px slate-300 + heading `font-bold text-slate-600` + sub `text-xs mt-1`
- **Pagination**: pattern persis dari InventoryClient (tombol icon rounded-xl border, badge halaman biru muda)
- **Font weight**: heading section `text-lg font-bold text-slate-800 flex items-center gap-2` dengan ikon lucide di depan
- **Spacing outer**: `space-y-6` untuk gap antar section

**Warna semantik tetap**: biru = primary/aksi, emerald = nilai/sukses/inbound, red = kritis/hapus, amber = warning/menipis, indigo = info sekunder, orange = outbound/keluar.

## Halaman 1: `/master` (`src/app/master/page.tsx`)

**Fungsi**: master data barang + tombol Import Excel + tombol tambah/edit + link cetak barcode + link detail.

**Yang berubah**:
1. Tambah KPI strip 4 kartu: Total SKU (Package, biru), SKU dengan Kode GL (Wallet, emerald — hitung dari `items.filter(i => i.kode_gl)`), Kategori Unik (Layers, indigo), Perlu Setup Harga (AlertTriangle, red — sementara hardcode 0, nanti bisa dihubungin ke SKU harga 0).
2. Panel tabel pakai layout `/inventory`: header dengan judul + search + tombol aksi kanan (Tambah Barang, Import Excel).
3. Kolom tabel: SKU + Kode GL badge + Nama + Kategori + Satuan (dengan konversi kalau ada) + Batas Minimum + Aksi (Detail, Cetak Barcode, Edit).
4. **Kode GL wajib tampak jelas** — badge kecil hijau/biru di dekat SKU dengan format `1442301` + tooltip keterangan.
5. Pagination persis pattern `/inventory`.
6. Modal tambah/edit dipertahankan logic-nya tapi styling di-align: `glass-panel`, input `bg-white/70 border border-slate-200 rounded-xl`, tombol simpan gradient biru.
7. Empty state kalau `filteredItems` kosong: icon ServerCrash + pesan.
8. **JANGAN ganggu** `DialogImport`, `getMasterBarang()`, `createMasterBarang()`, `updateMasterBarang()`, ataupun link cetak barcode (URL nya harus tetap).

## Halaman 2: `/permintaan` (`src/app/permintaan/page.tsx`)

**Fungsi**: input FPP dari Cabang (form kiri) + list FPP terakhir (kanan/bawah).

**Yang berubah**:
1. KPI strip 4 kartu: Total FPP Bulan Ini (ClipboardList, biru), FPP Terproses (CheckCircle2, emerald), Menunggu Realisasi (Clock, amber), FPP Tertutup (Archive, slate). Angka dari data existing atau tambah query kalau belum ada.
2. Form input FPP jadi `glass-panel rounded-2xl p-6` — grid 2 kolom di layar besar, form di kiri (nomor FPP auto-generate, cabang, wilayah selector JABODETABEK/NON, tanggal, detail item), summary + tombol submit di kanan.
3. **Wilayah selector** dibikin visual toggle 2 tombol besar (JABODETABEK dengan icon Building2, NON-JABODETABEK dengan icon Truck) — bukan dropdown biasa, karena ini keputusan penting yang beda alur BAST.
4. Baris item detail: row layout `grid grid-cols-12 gap-2` dengan search barang, qty, satuan (auto dari master), tombol hapus. Tombol "+ Tambah Barang" gaya ghost button biru.
5. Panel history di bawah: tabel FPP terakhir dengan kolom Nomor FPP + Nomor FPKB + Tanggal + Cabang + Wilayah (badge) + Status (badge) + Aksi (lihat detail).
6. Empty state list history: icon ClipboardList slate-300.
7. **JANGAN ganggu** `createFppBaru()`, `getFppList()`, `SearchableSelect` component, auto-generate nomor FPP+FPKB (`src/lib/sequence.ts`).

## Halaman 3: `/inbound` (`src/app/inbound/page.tsx`)

**Fungsi**: catat barang masuk (dari supplier/reprint), pilih lokasi rak, isi harga per satuan → bikin batch baru.

**Yang berubah**:
1. KPI strip 4 kartu: Inbound Bulan Ini (ArrowDownRight, emerald — jumlah transaksi), Nilai Inbound Bulan Ini (Wallet, emerald), Batch Aktif Total (Archive, indigo), Rata-rata Harga Bulan Ini (TrendingUp, biru). Angka dari data existing.
2. Modal input jadi `glass-panel` dengan sistem 2 kolom: kiri form (barang, lokasi rak, qty, harga satuan, tanggal masuk, catatan), kanan preview batch yang akan dibuat (SKU, nama, batch info live) + tombol simpan.
3. Tabel history inbound: kolom Tanggal + Barang (nama + SKU badge) + Qty + Satuan + Harga Satuan + Subtotal + Rak + Catatan. Baris hover + sort by tanggal DESC by default.
4. Filter chips bulan atas tabel: Bulan Ini / 3 Bulan / Semua. Search bar di sebelah.
5. Empty state: icon PackagePlus slate-300 + pesan "Belum ada inbound. Klik Tambah Inbound untuk mulai."
6. Pagination existing dipertahankan, styling di-align.
7. **JANGAN ganggu** `createInbound()`, `getRecentInbound()`, `SearchableSelect`, logic pembuatan batch di server.

## Halaman 4: `/outstanding` (`src/app/outstanding/page.tsx`)

**Fungsi**: list outstanding (barang belum ke-supply penuh dari FPKB), dengan tombol Proses Ulang & Tutup. Ada aturan role: hanya `ADMIN` (Staf) yang boleh tutup.

**Yang berubah**:
1. KPI strip 4 kartu: Total Outstanding Aktif (AlertTriangle, amber), Stok Sudah Cukup (CheckCircle2, emerald — outstanding yang stoknya udah restock, siap proses ulang; ini KEY VALUE PROPOSITION halaman ini), Nilai Outstanding (Wallet, red), Tertua Sejak (Clock, slate — hitung hari dari `createdAt` outstanding tertua).
2. Kartu "Stok Sudah Cukup" bisa diklik → filter list ke yang siap proses ulang aja (pattern sama kayak "Perlu Restock" di `/inventory`).
3. Filter chips: Semua / Siap Diproses Ulang / Menunggu Restock / (Kalau ADMIN) Yang Bisa Ditutup.
4. List item pakai card grid (bukan tabel), karena tiap outstanding punya info panjang: nomor FPP asal + nomor FPKB asal + barang + qty sisa + tanggal + tombol aksi. Layout kartu: kiri info, kanan tombol Proses Ulang (biru) + Tutup (red outline, HANYA MUNCUL untuk ADMIN).
5. Badge di kartu: kalau `stokTersedia >= qty_sisa` tampilkan badge hijau "Stok Siap ✓", kalau enggak badge slate "Menunggu Restock".
6. Empty state: icon PackageCheck emerald + pesan positif "🎉 Tidak ada outstanding. Semua permintaan sudah terpenuhi."
7. **JANGAN ganggu** `getOutstandingList()`, `tutupOutstanding()`, `prosesUlangOutstanding()`, gate `userRole === "ADMIN"`.

## Verifikasi setelah eksekusi

```bash
npm run build
```
Lolos linting + type check.

Lalu `npm run dev` dan cek manual:
- [ ] `/master` — KPI 4 kartu tampil, Kode GL badge muncul di baris (data dari seed v2.1), tombol Cetak Barcode masih ngarah ke `/master/cetak-barcode/[id]` dengan query yang benar
- [ ] `/permintaan` — form muncul, selector wilayah 2-tombol jelas beda visual, submit tetap generate nomor FPP+FPKB, list history tampil
- [ ] `/inbound` — modal input masih bikin batch, history muncul, filter chips bulan responsif
- [ ] `/outstanding` — list muncul (kalau ada; kalau nggak ada, empty state positif), tombol Tutup hanya muncul untuk role ADMIN
- [ ] Layar sempit (≤768px) — semua responsive, KPI jadi 2 kolom, tabel scrollable

## Yang JANGAN dilakukan
- Jangan ubah server action apa pun (semua file `actions.ts`)
- Jangan ubah schema, seed, atau `src/lib/*`
- Jangan sentuh `/`, `/inventory`, `/fpkb`, `/laporan`, `/rak`, `/master/cetak-barcode/[id]`, `/master/detail/[id]` (bagian batch B & C atau sudah selesai)
- Jangan buat komponen baru di luar 4 file page.tsx yang disebut, KECUALI perlu extract sub-komponen (mis. `KpiStripMaster.tsx`) — kalau iya, taruh di `src/components/kpi/` biar konsisten

Setelah selesai: commit + push dengan pesan `feat(ui): redesign batch A - master/permintaan/inbound/outstanding align dengan inventory`, lalu user akan cross-check ke sesi chat claude.ai.
