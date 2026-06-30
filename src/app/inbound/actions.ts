// src/app/inbound/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Tarik data untuk dropdown Form
export async function getInboundFormData() {
  const barang = await prisma.master_Barang.findMany({ orderBy: { nama: 'asc' } });
  const lokasi = await prisma.lokasi_Rak.findMany({
    orderBy: [{ gudang: 'asc' }, { lorong: 'asc' }, { rak: 'asc' }]
  });
  return { barang, lokasi };
}

// Tarik riwayat Inbound terbaru untuk tabel
export async function getRecentInbound() {
  return await prisma.mutasi_Ledger.findMany({
    where: { tipe_mutasi: 'INBOUND' },
    include: {
      batch: {
        include: { barang: true, lokasi: true }
      }
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Eksekusi transaksi Inbound + Smart Trigger Outstanding
export async function createInbound(formData: FormData) {
  try {
    const barangId = formData.get("barangId") as string;
    const lokasiId = formData.get("lokasiId") as string;
    const qty = parseInt(formData.get("qty") as string);
    const harga = parseFloat(formData.get("harga") as string) || 0;
    const referensi = formData.get("referensi") as string;
    const keterangan = formData.get("keterangan") as string;

    // Fitur Baru Fase 3: Supplier & Nomorator
    const supplier = formData.get("supplier") as string;
    const nomoratorAwal = formData.get("nomorator_awal") as string;
    const nomoratorAkhir = formData.get("nomorator_akhir") as string;

    let triggeredOutstandings: string[] = [];

    await prisma.$transaction(async (tx) => {
      // 1. Generate Batch Baru
      const batch = await tx.batch_Barang.create({
        data: {
          barangId,
          lokasiId,
          harga_satuan: harga,
          qty_awal: qty,
          qty_sisa: qty,
          status: 'AVAILABLE',
          supplier: supplier || null,
          nomorator_awal: nomoratorAwal || null,
          nomorator_akhir: nomoratorAkhir || null,
        }
      });

      // 2. Catat di Ledger
      await tx.mutasi_Ledger.create({
        data: {
          batchId: batch.id,
          tipe_mutasi: 'INBOUND',
          qty_perubahan: qty,
          saldo_akhir: qty,
          referensi,
          keterangan,
          createdBy: 'USER_MANUAL',
        }
      });

      // 3. SMART TRIGGER OUTSTANDING
      const outstandingReqs = await tx.permintaan_Outstanding.findMany({
        where: {
          barangId: barangId,
          status: 'OUTSTANDING'
        },
        include: {
          header: true,
          barang: true
        }
      });

      if (outstandingReqs.length > 0) {
        outstandingReqs.forEach((req) => {
          triggeredOutstandings.push(`▶️ ${req.header.cabang} (FPP: ${req.header.nomor_fpp}) - Kurang: ${req.qty_sisa} ${req.barang.satuan}`);
        });
      }
    });

    revalidatePath("/inbound");
    revalidatePath("/permintaan");

    return { success: true, triggeredOutstandings };
  } catch (error: unknown) {
    console.error("Gagal simpan Inbound:", error);
    const message = error instanceof Error ? error.message : "Gagal menyimpan transaksi Inbound.";
    return { success: false, error: message };
  }
}
