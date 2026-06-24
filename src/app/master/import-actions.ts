// src/app/master/import-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function importDataAwal(formattedData: any[]) {
  try {
    // Cari lokasi transit default untuk barang import
    const lokasiTransit = await prisma.lokasi_Rak.upsert({
      where: { qr_code: 'WMS-TRANSIT-MIGRASI-01' },
      update: {},
      create: { gudang: 'TRANSIT', lorong: 'MIGRASI', rak: '01', qr_code: 'WMS-TRANSIT-MIGRASI-01' }
    });

    let successCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of formattedData) {
        if (item.stok <= 0) continue; // Abaikan barang yang stoknya 0 di PRN

        // 1. Pastikan Master Barang ada
        const barang = await tx.master_Barang.upsert({
          where: { sku: item.kode_barang },
          update: {},
          create: {
            sku: item.kode_barang,
            nama: item.nama_barang,
            satuan: item.satuan,
            batas_minimum: item.stok_min,
            kategori: 'Migrasi', // Default
          }
        });

        // 2. Buat Batch Barang baru dengan supplier & nomorator
        const batch = await tx.batch_Barang.create({
          data: {
            barangId: barang.id,
            lokasiId: lokasiTransit.id,
            qty_awal: item.stok,
            qty_sisa: item.stok,
            harga_satuan: item.harga_satuan,
            supplier: item.supplier,
            nomorator: item.nomorator,
            status: 'AVAILABLE'
          }
        });

        // 3. Catat di Ledger
        await tx.mutasi_Ledger.create({
          data: {
            batchId: batch.id,
            tipe_mutasi: 'INBOUND',
            qty_perubahan: item.stok,
            saldo_akhir: item.stok,
            referensi: 'Migrasi Data Awal (PRN/Excel)',
            keterangan: `Sistem Lama | Supp: ${item.supplier || '-'}`,
            createdBy: 'SYSTEM_MIGRASI'
          }
        });
        
        successCount++;
      }
    });

    revalidatePath("/master");
    return { success: true, count: successCount };
  } catch (error: any) {
    console.error("Gagal Import:", error);
    return { success: false, error: "Gagal memproses import data. Pastikan format sesuai." };
  }
}