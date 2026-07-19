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