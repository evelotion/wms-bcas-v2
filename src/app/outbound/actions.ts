"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Tarik data dropdown (Hanya barang yang stoknya lebih dari 0)
export async function getOutboundFormData() {
  const barang = await prisma.master_Barang.findMany({
    where: { batches: { some: { qty_sisa: { gt: 0 } } } },
    orderBy: { nama: 'asc' },
    include: {
      batches: {
        where: { qty_sisa: { gt: 0 } },
        select: { qty_sisa: true }
      }
    }
  });

  // Hitung total stok dinamis dari akumulasi sisa semua batch
  const formattedBarang = barang.map(b => {
    const totalStok = b.batches.reduce((sum, batch) => sum + batch.qty_sisa, 0);
    return { id: b.id, sku: b.sku, nama: b.nama, totalStok };
  });

  return { barang: formattedBarang };
}

// Tarik riwayat Outbound terbaru
export async function getRecentOutbound() {
  return await prisma.mutasi_Ledger.findMany({
    where: { tipe_mutasi: 'OUTBOUND' },
    include: { batch: { include: { barang: true, lokasi: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
}

// CORE ENGINE: Eksekusi Outbound dengan Smart FIFO Allocation
export async function createOutbound(formData: FormData) {
  try {
    const barangId = formData.get("barangId") as string;
    const qtyRequested = parseInt(formData.get("qty") as string);
    const tujuan = formData.get("tujuan") as string;
    const referensi = formData.get("referensi") as string;
    const keterangan = `Tujuan Cabang/Unit: ${tujuan} | ${formData.get("keterangan") as string}`;

    let sisaKebutuhan = qtyRequested;
    let instruksiPicker: string[] = [];

    // Gunakan Transaction agar jika di tengah jalan gagal, database tidak rusak
    await prisma.$transaction(async (tx) => {
      // 1. Ambil SEMUA batch barang ini yang stoknya > 0, urutkan dari TANGGAL TERMASUK PALING TUA (FIFO)
      const batchesTersedia = await tx.batch_Barang.findMany({
        where: { barangId, qty_sisa: { gt: 0 } },
        orderBy: { tanggal_masuk: 'asc' }, 
        include: { lokasi: true }
      });

      const totalTersedia = batchesTersedia.reduce((sum, b) => sum + b.qty_sisa, 0);
      if (totalTersedia < qtyRequested) {
        throw new Error(`Stok fisik tidak cukup! Diminta: ${qtyRequested}, Tersedia: ${totalTersedia}`);
      }

      // 2. Mulai Looping Pemotongan Stok
      for (const batch of batchesTersedia) {
        if (sisaKebutuhan <= 0) break; // Kebutuhan sudah terpenuhi, hentikan loop

        // Tentukan seberapa banyak yang bisa diambil dari batch ini
        const qtyDipotong = Math.min(sisaKebutuhan, batch.qty_sisa);
        const qtySisaBaru = batch.qty_sisa - qtyDipotong;
        const statusBaru = qtySisaBaru === 0 ? 'DEPLETED' : 'AVAILABLE';

        // 3. Update Sisa Stok di Batch
        await tx.batch_Barang.update({
          where: { id: batch.id },
          data: { qty_sisa: qtySisaBaru, status: statusBaru }
        });

        // 4. Catat Jejak di Ledger (Nilai negatif)
        await tx.mutasi_Ledger.create({
          data: {
            batchId: batch.id,
            tipe_mutasi: 'OUTBOUND',
            qty_perubahan: -qtyDipotong, 
            saldo_akhir: qtySisaBaru,
            referensi,
            keterangan,
            createdBy: 'USER_MANUAL', 
          }
        });

        sisaKebutuhan -= qtyDipotong;
        instruksiPicker.push(`Ambil ${qtyDipotong} Pcs dari Rak ${batch.lokasi.lorong}-${batch.lokasi.rak} (Batch Masuk: ${batch.tanggal_masuk.toLocaleDateString()})`);
      }
    });

    revalidatePath("/outbound");
    return { success: true, instruksi: instruksiPicker };
  } catch (error: any) {
    console.error("Gagal Outbound:", error);
    return { success: false, error: error.message || "Gagal memproses Outbound FIFO." };
  }
}