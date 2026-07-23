// src/app/inventory/page.tsx
import prisma from "@/lib/prisma";
import InventoryClient from "./InventoryClient";
import { InventoryItem } from "./types";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const masterData = await prisma.master_Barang.findMany({
    include: {
      batches: {
        where: {
          qty_sisa: { gt: 0 },
          status: 'AVAILABLE'
        },
        include: { lokasi: true },
        orderBy: { tanggal_masuk: 'asc' }
      }
    },
    orderBy: { nama: 'asc' }
  });

  // Ambil mutasi 3 terakhir per SKU. Strategi: ambil N=3 * jumlah SKU mutasi terbaru,
  // lalu grup di-app-level. Ini praktis karena mutasi punya index natural via createdAt DESC.
  // Untuk skala 112 SKU, ambil 500 terakhir sudah cukup mewakili 3 terakhir per SKU
  // (rata-rata SKU aktif punya < 5 mutasi/bulan).
  const semuaMutasiTerbaru = await prisma.mutasi_Ledger.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: {
      batch: { select: { barangId: true } }
    }
  });

  // Group per barangId, ambil top 3
  const mutasiPerSku = new Map<string, typeof semuaMutasiTerbaru>();
  for (const m of semuaMutasiTerbaru) {
    const bid = m.batch.barangId;
    const arr = mutasiPerSku.get(bid) ?? [];
    if (arr.length < 3) {
      arr.push(m);
      mutasiPerSku.set(bid, arr);
    }
  }

  const inventoryData: InventoryItem[] = masterData.map((barang: any) => {
    // Kalkulasi Total Stok
    const totalStok = barang.batches.reduce((sum: number, batch: any) => sum + batch.qty_sisa, 0);
    
    // Kalkulasi Total Nilai Aset (Harga * Qty per masing-masing batch)
    const totalNilai = barang.batches.reduce((sum: number, batch: any) => sum + (batch.qty_sisa * (batch.harga_satuan || 0)), 0);

    return {
      id: barang.id,
      sku: barang.sku,
      nama: barang.nama,
      kategori: barang.kategori,
      satuan: barang.satuan,
      satuan_besar: barang.satuan_besar,
      isi_per_satuan_besar: barang.isi_per_satuan_besar,
      batas_minimum: barang.batas_minimum,
      totalStok,
      totalNilai, // Masukin ke props
      batch_Barang: barang.batches.map((batch: any) => ({
        id: batch.id,
        qty_sisa: batch.qty_sisa,
        harga_satuan: batch.harga_satuan || 0, // Ambil harga
        tanggal_masuk: batch.tanggal_masuk ? new Date(batch.tanggal_masuk).toISOString() : null,
        lokasi: batch.lokasi ? {
          gudang: batch.lokasi.gudang,
          rak: batch.lokasi.rak,
          lorong: batch.lokasi.lorong
        } : null
      })),
      recentMutasi: (mutasiPerSku.get(barang.id) ?? []).map((m) => ({
        id: m.id,
        tipe: m.tipe_mutasi,
        // qty_perubahan tandanya tidak konsisten lintas sumber (seed historis OUTBOUND
        // negatif, transaksi live OUTBOUND positif) — simpan besaran absolut saja,
        // arah masuk/keluar ditentukan dari `tipe` di sisi tampilan.
        qty: Math.abs(m.qty_perubahan),
        referensi: m.referensi ?? null,
        keterangan: m.keterangan ?? null,
        tanggal: m.createdAt.toISOString(),
      })),
    };
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stok Terkini & Valuasi</h1>
          <p className="text-sm text-gray-500 mt-1">Pantau ketersediaan barang, lokasi rak, dan nilai aset FIFO.</p>
        </div>
      </div>
      <InventoryClient initialData={inventoryData} />
    </div>
  );
}