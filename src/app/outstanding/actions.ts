"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// 1. Ambil daftar barang yang masih ngutang
export async function getOutstandingList() {
  return await prisma.permintaan_Outstanding.findMany({
    where: { status: 'OUTSTANDING' },
    include: { 
      barang: true, 
      header: true 
    },
    orderBy: { createdAt: 'desc' }
  });
}

// 2. Eksekusi Pelunasan Outstanding
export async function resolveOutstandingItem(outstandingId: string, qtyFulfill: number, gudangId: string) {
  try {
    let instruksi: string[] = [];
    
    await prisma.$transaction(async (tx) => {
      // Cari record outstanding
      const outstanding = await tx.permintaan_Outstanding.findUnique({
        where: { id: outstandingId },
        include: { header: true, barang: true }
      });

      if (!outstanding) throw new Error("Data outstanding tidak ditemukan");
      if (qtyFulfill > outstanding.qty_sisa) throw new Error("Qty melebihi sisa hutang!");
      if (qtyFulfill <= 0) throw new Error("Qty harus lebih dari 0");

      let qtyToProcess = qtyFulfill;
      let qtyDapat = 0;

      // PROSES 1: Potong Stok dari Rak (Cari batch yang available)
      const availableBatches = await tx.batch_Barang.findMany({
        where: { barangId: outstanding.barangId, qty_sisa: { gt: 0 }, status: 'AVAILABLE' },
        orderBy: { tanggal_masuk: 'asc' },
        include: { lokasi: true }
      });

      for (const batch of availableBatches) {
        if (qtyToProcess <= 0) break;
        const potong = Math.min(batch.qty_sisa, qtyToProcess);
        qtyToProcess -= potong;
        qtyDapat += potong;

        const sisaDiRak = batch.qty_sisa - potong;
        
        // Update batch
        await tx.batch_Barang.update({
          where: { id: batch.id },
          data: { qty_sisa: sisaDiRak, status: sisaDiRak <= 0 ? 'DEPLETED' : 'AVAILABLE' }
        });

        instruksi.push(`Ambil ${potong} ${outstanding.barang.satuan} [${outstanding.barang.sku}] dari Rak ${batch.lokasi.lorong}-${batch.lokasi.rak}`);

        // Catat di Ledger
        await tx.mutasi_Ledger.create({
          data: {
            batchId: batch.id, 
            tipe_mutasi: 'OUTBOUND', 
            qty_perubahan: potong,
            saldo_akhir: sisaDiRak, 
            referensi: outstanding.header.nomor_fpkb + " (Susulan)",
            keterangan: `Pemenuhan Outstanding FPKB Cabang ${outstanding.header.cabang}`, 
            createdBy: gudangId || 'SYSTEM_GUDANG'
          }
        });
      }

      if (qtyDapat < qtyFulfill) {
        throw new Error(`Stok fisik di rak tidak cukup! Sistem hanya menemukan ${qtyDapat} barang.`);
      }

      // PROSES 2: Update Record Outstanding
      const sisaHutangBaru = outstanding.qty_sisa - qtyDapat;
      await tx.permintaan_Outstanding.update({
        where: { id: outstandingId },
        data: {
          qty_sisa: sisaHutangBaru,
          status: sisaHutangBaru === 0 ? 'FULFILLED' : 'OUTSTANDING'
        }
      });

      // PROSES 3: Update Detail Permintaan (Tambah qty_disetujui)
      const detail = await tx.permintaan_Detail.findFirst({
        where: { headerId: outstanding.headerId, barangId: outstanding.barangId }
      });

      if (detail) {
        const newQtyDisetujui = detail.qty_disetujui + qtyDapat;
        await tx.permintaan_Detail.update({
          where: { id: detail.id },
          data: {
            qty_disetujui: newQtyDisetujui,
            status_item: newQtyDisetujui >= detail.qty_diminta ? 'FULFILLED' : 'PARTIAL'
          }
        });
      }

      // PROSES 4: Cek apakah seluruh FPKB ini sudah lunas?
      const remainingOutstanding = await tx.permintaan_Outstanding.count({
        where: { headerId: outstanding.headerId, status: 'OUTSTANDING', id: { not: outstandingId } }
      });

      // Kalau sisa hutang item ini udah 0, dan gak ada item ngutang lain di FPKB yang sama
      if (remainingOutstanding === 0 && sisaHutangBaru === 0) {
        await tx.permintaan_Header.update({
          where: { id: outstanding.headerId },
          data: { status: 'COMPLETED' }
        });
      }
    });

    revalidatePath("/outstanding");
    revalidatePath("/permintaan");
    return { success: true, instruksi };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}