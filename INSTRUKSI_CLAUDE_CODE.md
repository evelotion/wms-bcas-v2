# Instruksi: Redesign halaman /inventory

## Scope
Ganti SATU file saja: `src/app/inventory/InventoryClient.tsx` dengan file `InventoryClient.tsx` terlampir (drop-in replacement).

**JANGAN ubah** `src/app/inventory/page.tsx`, `src/app/inventory/types.ts`, `globals.css`, atau file lain — interface props (`initialData: InventoryItem[]`) dan semua field yang dipakai sudah sama persis dengan yang dikirim server sekarang.

## Apa yang berubah (buat konteks review)
1. **KPI strip** di atas tabel: Total SKU, Nilai Aset FIFO (format ringkas jt/M), Perlu Restock (klik = toggle filter kritis), Batch Aktif. Semua dihitung client-side dari `initialData` via `useMemo`.
2. **Status 2-tier → 3-tier**: Kritis (stok <= batas_minimum), Menipis (<= 1.5x batas_minimum), Aman. Ada filter chips Semua/Kritis/Menipis/Aman.
3. **Sorting** di header kolom: Barang (A-Z), Stok, Total Aset. Klik kedua kali = balik arah.
4. **Kolom Barang digabung**: nama + SKU + kategori dalam satu sel (kategori sebelumnya di-fetch tapi tidak pernah ditampilkan).
5. **Stock health bar** mini di kolom Stok — proporsi stok terhadap 2x batas_minimum, warna ikut kondisi. Ada guard `batas_minimum <= 0`.
6. **Expanded row jadi "Antrean FIFO"**: batch ditampilkan sebagai kartu berurutan (data sudah di-order `tanggal_masuk asc` dari server), batch #1 diberi badge "Keluar berikutnya" + aksen biru, tiap batch menampilkan tanggal masuk + umur hari (sebelumnya `tanggal_masuk` di-fetch tapi tidak ditampilkan), rak/lorong, harga satuan, subtotal.
7. **Search diperluas**: SKU, nama, DAN kategori.
8. Pagination & glassmorphism dipertahankan seperti sebelumnya.

## Verifikasi setelah replace
```bash
npm run build
```
Lalu cek manual di `npm run dev`:
- [ ] KPI strip angkanya masuk akal (bandingkan Nilai Aset dengan jumlah manual beberapa barang)
- [ ] Klik kartu "Perlu Restock" → tabel terfilter kritis, klik lagi → balik ke Semua
- [ ] Sort Stok / Total Aset naik-turun benar
- [ ] Expand baris → batch urut dari tanggal masuk terlama, badge "Keluar berikutnya" di batch #1
- [ ] Barang tanpa batch → pesan kosong tampil, tidak crash
- [ ] Responsive di layar sempit (chips & search wrap, batch card jadi vertikal)

## Catatan
- `Math.round` ditambahkan di `formatRupiah` untuk jaga-jaga nilai float dari perkalian qty*harga.
- Threshold "Menipis" (1.5x) hardcoded di `getKondisi` — gampang diubah kalau Staf mau angka lain.
