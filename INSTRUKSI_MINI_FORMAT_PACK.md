# INSTRUKSI MINI — Format Stok Pack-Aware di Inventory

> Untuk Claude Code. Small polish: ubah cara stok ditampilkan di `/inventory` supaya pakai satuan besar (Pack/Box/Rim) yang biasa dipakai staf, dengan sisa satuan kecil kalau tidak habis dibagi. Data & logika tetap; hanya format tampil.

## Scope
Satu file: `src/app/inventory/InventoryClient.tsx`. Server action & types JANGAN disentuh.

## Bagaimana angka dihitung sekarang (jangan diubah)
`item.totalStok` = jumlah `qty_sisa` semua batch, dalam satuan kecil (Lembar/Pcs/Set). Ini benar dan tetap dipakai untuk logika `getKondisi()`, sorting, KPI. Yang berubah HANYA cara render angka ke user.

## Aturan tampilan baru

Tambahkan helper di dekat helper format Rupiah:

```ts
// Format qty pack-aware.
// - Kalau tidak punya satuan_besar (atau isi_per_satuan_besar <= 1): "551 Pcs"
// - Kalau habis dibagi: "226 Pack" (subteks kecil "= 226,000 Lembar")
// - Kalau ada sisa: "7 Pack + 500 Set" (subteks kecil "= 7,500 Set")
function formatQtyPack(qtyKecil: number, satuan: string, satuanBesar: string | null | undefined, isiPerBesar: number | null | undefined) {
  const isi = Number(isiPerBesar) || 1;
  if (!satuanBesar || isi <= 1) {
    return { utama: `${qtyKecil.toLocaleString("id-ID")} ${satuan}`, sub: null };
  }
  const besar = Math.floor(qtyKecil / isi);
  const sisa = qtyKecil - besar * isi;
  const sub = `= ${qtyKecil.toLocaleString("id-ID")} ${satuan}`;
  if (sisa === 0) return { utama: `${besar.toLocaleString("id-ID")} ${satuanBesar}`, sub };
  return { utama: `${besar.toLocaleString("id-ID")} ${satuanBesar} + ${sisa.toLocaleString("id-ID")} ${satuan}`, sub };
}
```

## Titik penerapan

### 1. Kolom "Stok" di tabel utama
Pakai `formatQtyPack(item.totalStok, item.satuan, item.satuan_besar, item.isi_per_satuan_besar)`.
Render:
```tsx
<span className="font-black text-lg text-slate-700">{f.utama}</span>
{f.sub && <div className="text-[10px] text-slate-400 mt-0.5">{f.sub}</div>}
```
Kalimat "min. X" tetap pakai satuan kecil supaya bar kesehatan tetap konsisten (min itu di database dalam satuan kecil).

### 2. Batas minimum di bar kesehatan
Ganti label bar dari "min. 200" ke "min. 200 Lembar" (tampilkan satuan supaya user tahu apa yg dibandingkan).

### 3. Antrean FIFO (expanded row)
Kolom qty batch (`{batch.qty_sisa} {item.satuan}`) juga pakai `formatQtyPack`. Sisi harga tetap: `@ Rp X,XX = Rp Y,YY` dihitung dari satuan kecil (jangan diubah, harga per satuan kecil).

### 4. TypeScript types
Cek `src/app/inventory/types.ts` — `InventoryItem` harus punya `satuan_besar: string | null` dan `isi_per_satuan_besar: number`. Kalau belum ada, tambahkan. Cek juga `page.tsx` (server side) — pastikan Prisma select mengembalikan kedua field ini (harusnya sudah karena default `findMany` include semua field non-relation).

## Verifikasi

```bash
npm run build
```
lolos, lalu manual di `/inventory`:

- [ ] **IDSS-179** (Ban Uang, isi 1000): kolom Stok = `226 Pack` dengan subteks `= 226.000 Lembar`
- [ ] **IDSS-508** (Buku Bilyet Giro, isi 25): kolom Stok = `300 Buku` dengan subteks `= 7.500 Set`
- [ ] **PRO-001** (Ballpoint, tanpa satuan besar): kolom Stok = `551 Pcs` (tanpa subteks)
- [ ] **UMMS-501** (Slip Pembukuan, isi 250): kolom Stok = `193 Rim` dengan subteks `= 48.250 Lembar`
- [ ] Expanded row (klik chevron) → batch di dalam Antrean FIFO juga pakai format sama, harga per satuan kecil tetap tampil di sisi kanan
- [ ] Sorting kolom Stok tetap benar (harus sort by `totalStok` satuan kecil, tidak by string tampilan)

## Commit
Pesan: `feat(ui): tampilan stok pack-aware di /inventory (satuan besar + sisa)`
