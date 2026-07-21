# INSTRUKSI HOTFIX + BATCH B-EXPRESS

> Untuk Claude Code. Menutup celah pasca-Batch A yang muncul saat user testing action button di `/master`. Kerjaannya: 1 bug fix runtime (error 500), 1 form completeness, redesign 2 halaman terkait (detail + cetak-barcode), semua dalam satu commit.

## Konteks masalah yang dilaporkan user
- **Klik "Detail Barang" → HTTP 500** di `/master/detail/[id]`
- **Klik "Cetak Barcode"** membuka halaman yang tampilannya nggak selaras dengan sistem baru
- **Klik "Edit Barang"** membuka modal yang minimal (tanpa field Kode GL) — padahal ada 3 SKU (IDSS-003, IDSS-004, IDSS-302) yang perlu dilengkapi kode GL manual via UI

## Perbaikan 1 — Hotfix Error 500 di `/master/detail/[id]`

**File**: `src/app/master/detail/[id]/page.tsx`

**Root cause**: Signature `params: Promise<{ id: string }>` salah untuk Next.js 14.2 (di 14.2, `params` masih object langsung, bukan Promise seperti di Next 15). Cast `(params as any).id` bisa fail runtime.

**Fix**: gunakan signature dan destructuring yang benar untuk Next 14, dan hapus `generateStaticParams` yang tidak diperlukan (halaman ini pure dynamic, tidak mau di-prerender). Tulis persis seperti ini:

```tsx
import DetailBarangClient from "./DetailBarangClient";

export const dynamic = "force-dynamic";

export default function DetailBarangPage({ params }: { params: { id: string } }) {
  return <DetailBarangClient id={params.id} />;
}
```

Lakukan hal serupa untuk `src/app/master/cetak-barcode/[id]/page.tsx` — hapus `generateStaticParams`, tambah `export const dynamic = "force-dynamic";`, tapi biarkan dynamic import ssr:false yang sudah ada.

## Perbaikan 2 — Form Edit `/master` lengkapi field GL

**File**: `src/app/master/page.tsx` (modal) dan `src/app/master/actions.ts` (`createMasterBarang` & `updateMasterBarang`)

**Di modal**: tambah 2 field di bawah "Kategori" (sebelum "Satuan"), styling ikut pattern input yang sudah ada di modal:
- `kode_gl` — text input, opsional, placeholder `Contoh: 1442301`, `defaultValue={editingItem?.kode_gl || ""}`, `pattern="[0-9]*"` biar keyboard mobile numeric
- `keterangan_gl` — text input, opsional, placeholder `Contoh: BARANG CETAKAN`, `defaultValue={editingItem?.keterangan_gl || ""}`

Kalau modal terlalu penuh secara visual, boleh dibungkus dengan collapsible/details `<details>` berlabel "Kode GL (opsional)" — tapi default expanded kalau sedang edit dan salah satu field udah terisi.

**Di server action** (kedua fungsi `create` dan `update`): tambahkan ke object `data` Prisma:
```ts
kode_gl: (formData.get("kode_gl") as string) || null,
keterangan_gl: (formData.get("keterangan_gl") as string) || null,
```

Setelah tersimpan, KPI "SKU dengan Kode GL" di `/master` otomatis update via `revalidatePath("/master")` yang sudah ada.

## Perbaikan 3 — Redesign `/master/detail/[id]/DetailBarangClient.tsx`

**Prinsip**: align gaya visual dengan `/inventory` (yang jadi acuan sistem). Struktur konten yang sudah ada BAGUS, jangan diobrak-abrik — cuma poles gaya visual dan tambah info batch yang relevan.

**Yang tetap**: signature `{ id }: { id: string }`, useState/useEffect fetch, tampilan tabel mutasi (Log Kartu Stok).

**Yang berubah**:
1. **Header**: tombol back + judul jadi bar `flex items-center justify-between` — kiri = back + judul "Detail & Kartu Stok" + subteks nama barang; kanan = tombol "Cetak Barcode" (ghost button biru, link ke `/master/cetak-barcode/${id}?nama=...&sku=...`) supaya user tidak perlu balik ke `/master` cuma buat cetak.
2. **Info Card Utama**: pertahankan pattern glass-panel + gradient. Tapi jadikan **KPI strip 4 kartu**: Total Stok (Boxes, warna dinamis merah/emerald sesuai `totalStok vs batas_minimum`), Jumlah Batch Aktif (Archive, indigo), Nilai Stok Total (Wallet, emerald — hitung `batches.reduce((s,b) => s + b.qty_sisa * b.harga_satuan, 0)`), Batas Minimum (AlertTriangle, amber). Grid `grid-cols-2 lg:grid-cols-4 gap-4`.
3. **Metadata barang** (SKU, Kode GL, Kategori, Satuan, keterangan GL): panel `glass-panel rounded-2xl p-5` sendiri di bawah KPI. Layout `flex flex-wrap gap-x-6 gap-y-2` dengan tiap field: label kecil uppercase abu + value bold slate-800. Kode GL dan keterangan GL tampil PROMINEN sebagai badge mono biru kecil (bukan abu-abu seperti sekarang) supaya konsisten dengan tampilan di list `/master`.
4. **Panel Batch Aktif** (BARU — sebelumnya tidak ditampilkan): sebelum panel Log Mutasi. `glass-panel rounded-2xl`, header "Batch Stok Aktif" dengan icon Layers biru, list card per batch berisi: nomor batch (mono), rak+lorong, tanggal masuk + umur hari, qty sisa + satuan, harga satuan + subtotal. Pattern persis dari expanded row FIFO di `InventoryClient.tsx` (bisa lift langsung). Kalau `batches.length === 0`, tampilkan empty state "Belum ada batch aktif" dengan icon Archive slate-300.
5. **Panel Log Mutasi**: pertahankan struktur, ganti gaya:
   - Panel wrapper: `glass-panel rounded-2xl overflow-hidden`
   - Header: `bg-white/40 border-b border-slate-200/60`
   - Thead: `bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider`
   - Baris: `hover:bg-white/60` + `divide-y divide-slate-100/60`
   - Badge tipe INBOUND: `bg-emerald-50 text-emerald-600 border-emerald-100` pill dengan ArrowDownToLine
   - Badge tipe OUTBOUND: `bg-red-50 text-red-600 border-red-100` pill dengan ArrowUpRight
   - Empty state: PackageOpen slate-300 + pesan
6. Loading & error state di-refresh: glass-panel dengan icon (Loader2 spin untuk loading, ServerCrash untuk error).

**JANGAN ubah** `getDetailBarangLengkap()` server action — data yang di-fetch sudah cukup (barang, batches, mutasi, totalStok).

## Perbaikan 4 — Redesign `/master/cetak-barcode/[id]/CetakBarcodeClient.tsx`

**Prinsip khusus**: ini halaman utility yang tujuannya di-PRINT. Screen UI boleh premium, tapi **area yang akan tercetak WAJIB lean** (putih polos, tanpa glass, tanpa gradient) supaya:
- Barcode/QR ter-scan bersih (kontras maksimal)
- Toner tidak boros
- Kertas bisa langsung ditempel di rak/box tanpa terlihat murahan

**Struktur baru**:
1. **Toolbar atas** (screen only, `no-print` class): back button + judul "Cetak Label Barang" + tombol Print (gradient biru, gede, dengan icon Printer). Layout `flex items-center justify-between` di dalam `glass-panel rounded-2xl p-4`.
2. **Panel kontrol** (screen only, `no-print`): `glass-panel rounded-2xl p-6` — pilihan tipe (toggle segmented Barcode/QR Code, pattern chips seperti filter di `/inventory`), pilihan ukuran label (opsional 3 preset: Kecil 40×20mm, Sedang 60×30mm, Besar 80×50mm), dan (opsional, kalau mudah) input jumlah copy 1–20 pakai number input.
3. **Preview cetak** (JUGA ini yang tercetak): container `bg-white border border-slate-200 rounded-2xl p-8 print:border-0 print:rounded-none print:p-0` — di dalamnya kartu label yang aktual: nama barang bold di atas, kode/QR di tengah dengan ukuran sesuai pilihan, SKU mono kecil di bawah. Kalau `copy > 1`, render grid `grid grid-cols-2 gap-4 print:gap-2`.
4. **CSS print**: pastikan `@media print` menyembunyikan `.no-print` dan hilangkan semua background non-putih. Gunakan Tailwind `print:` prefix.

**Wajib dipertahankan**:
- `useParams()` client-side + `useSearchParams()` untuk nama/sku (existing).
- QR pointing ke `/master/detail/${id}` (existing — konsistensi dengan action button "Detail").
- Loading state saat `qrUrl` belum siap.
- `handlePrint = () => window.print()`.

## Verifikasi

```bash
npm run build
```
Lolos linting + type check.

Manual test di `npm run dev`:
- [ ] `/master` → klik "Detail" pada baris manapun → halaman detail muncul (BUKAN 500), KPI 4 kartu tampil, batch aktif ter-list (spot-check IDSS-508 harusnya 2 batch, IDSS-179 1 batch qty 226.000), log mutasi tampil.
- [ ] Klik "Cetak Barcode" dari `/master` maupun dari toolbar detail → halaman cetak muncul, toggle Barcode/QR berfungsi, preview akurat, `Ctrl+P` → yang tercetak cuma preview label (toolbar & kontrol hilang di print preview).
- [ ] `/master` → klik "Edit" pada IDSS-003 → modal muncul dengan field kode_gl & keterangan_gl (kosong untuk SKU ini), isi `1442301` dan `BARANG CETAKAN`, simpan. Kembali ke `/master`, KPI "SKU dengan Kode GL" naik dari 109 → 110. Refresh halaman → nilai persisten.
- [ ] `/master` → klik "Edit" pada SKU yang sudah punya GL (mis. IDSS-179) → field kode_gl terisi `1442301` sebagai defaultValue.

## Yang JANGAN dilakukan
- Jangan ubah `getDetailBarangLengkap()`, `getMasterBarang()`, atau server action lain di luar `createMasterBarang` / `updateMasterBarang`.
- Jangan sentuh schema Prisma — `kode_gl` dan `keterangan_gl` sudah nullable.
- Jangan sentuh `/`, `/inventory`, `/fpkb`, `/laporan`, `/rak` (rak masuk Batch B nanti terpisah).
- Jangan bikin komponen shared BatchCard yang di-import dua tempat — sementara duplicate inline di DetailBarangClient acceptable. Refactor bisa nanti.

Setelah selesai: commit + push dengan pesan `fix: hotfix detail 500 + form GL + redesign detail & cetak-barcode`, laporkan ke sesi chat untuk cross-check.
