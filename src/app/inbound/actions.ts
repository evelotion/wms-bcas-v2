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
    // take: 10 <--- INI KITA HAPUS BIAR PAGINATION DI UI BERFUNGSI
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
    const nomorator = formData.get("nomorator") as string;

    let triggeredOutstandings: string[] = [];

    await prisma.$transaction(async (tx) => {
      // 1. Generate Batch Baru (Sekarang nyimpen Supplier & Nomorator)
      const batch = await tx.batch_Barang.create({
        data: {
          barangId,
          lokasiId,
          harga_satuan: harga,
          qty_awal: qty,
          qty_sisa: qty,
          status: 'AVAILABLE',
          supplier: supplier || null,
          nomorator: nomorator || null,
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
        outstandingReqs.forEach(req => {
          triggeredOutstandings.push(`▶️ ${req.header.cabang} (FPP: ${req.header.nomor_fpp}) - Kurang: ${req.qty_sisa} ${req.barang.satuan}`);
        });
      }
    });

    revalidatePath("/inbound");
    revalidatePath("/permintaan"); 
    
    return { success: true, triggeredOutstandings };
  } catch (error: any) {
    console.error("Gagal simpan Inbound:", error);
    return { success: false, error: error.message || "Gagal menyimpan transaksi Inbound." };
  }
}