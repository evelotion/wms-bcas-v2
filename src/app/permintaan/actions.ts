// src/app/permintaan/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// 1. Tarik data barang untuk Form Request (Lengkap dengan total stok)
export async function getPermintaanFormData() {
  const barang = await prisma.master_Barang.findMany({
    orderBy: { nama: 'asc' },
    include: { batches: { select: { qty_sisa: true } } }
  });
  
  const formattedBarang = barang.map(b => ({
    ...b,
    totalStok: b.batches.reduce((sum, batch) => sum + batch.qty_sisa, 0)
  }));
  
  return { barang: formattedBarang };
}

// 2. Tarik daftar antrean permintaan
export async function getDaftarPermintaan() {
  return await prisma.permintaan_Header.findMany({
    include: { details: { include: { barang: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

// 3. Fungsi Cabang Membuat Request Baru
export async function createPermintaan(formData: FormData) {
  try {
    const cabang = formData.get("cabang") as string;
    const pic_nama = formData.get("pic_nama") as string;
    const barangId = formData.get("barangId") as string;
    const qty_diminta = parseInt(formData.get("qty") as string);
    const keterangan = formData.get("keterangan") as string;

    const nomor_request = `REQ-${new Date().getTime()}`; 

    await prisma.permintaan_Header.create({
      data: {
        nomor_request,
        cabang,
        pic_nama,
        keterangan,
        status: 'PENDING',
        details: {
          create: {
            barangId,
            qty_diminta,
            status_item: 'PENDING',
          }
        }
      }
    });

    revalidatePath("/permintaan");
    return { success: true };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: "Gagal membuat permintaan." };
  }
}

// 4. CORE ENGINE: SPV Approve & Jalankan FIFO + Outstanding
export async function approvePermintaan(headerId: string) {
  try {
    let instruksiPicker: string[] = [];

    await prisma.$transaction(async (tx) => {
      const header = await tx.permintaan_Header.findUnique({
        where: { id: headerId },
        include: { details: { include: { barang: true } } }
      });

      if (!header || header.status !== 'PENDING') throw new Error("Permintaan tidak valid atau sudah diproses.");

      let allFulfilled = true;

      for (const detail of header.details) {
        let sisaKebutuhan = detail.qty_diminta;
        let qtyDisetujuiTotal = 0;

        const batchesTersedia = await tx.batch_Barang.findMany({
          where: { barangId: detail.barangId, qty_sisa: { gt: 0 } },
          orderBy: { tanggal_masuk: 'asc' },
          include: { lokasi: true }
        });

        for (const batch of batchesTersedia) {
          if (sisaKebutuhan <= 0) break;

          const qtyDipotong = Math.min(sisaKebutuhan, batch.qty_sisa);
          const qtySisaBaru = batch.qty_sisa - qtyDipotong;

          await tx.batch_Barang.update({
            where: { id: batch.id },
            data: { qty_sisa: qtySisaBaru, status: qtySisaBaru === 0 ? 'DEPLETED' : 'AVAILABLE' }
          });

          await tx.mutasi_Ledger.create({
            data: {
              batchId: batch.id,
              tipe_mutasi: 'OUTBOUND',
              qty_perubahan: -qtyDipotong,
              saldo_akhir: qtySisaBaru,
              referensi: header.nomor_request,
              keterangan: `Fulfillment untuk ${header.cabang} (PIC: ${header.pic_nama})`,
              createdBy: 'SYSTEM_APPROVAL'
            }
          });

          sisaKebutuhan -= qtyDipotong;
          qtyDisetujuiTotal += qtyDipotong;
          instruksiPicker.push(`[${detail.barang.sku}] Ambil ${qtyDipotong} Pcs dari Rak ${batch.lokasi.lorong}-${batch.lokasi.rak}`);
        }

        const statusItemBaru = sisaKebutuhan > 0 ? 'OUTSTANDING' : 'FULFILLED';
        if (sisaKebutuhan > 0) allFulfilled = false;

        await tx.permintaan_Detail.update({
          where: { id: detail.id },
          data: { qty_disetujui: qtyDisetujuiTotal, status_item: statusItemBaru }
        });
      }

      await tx.permintaan_Header.update({
        where: { id: headerId },
        data: { status: allFulfilled ? 'APPROVED' : 'OUTSTANDING' }
      });
    });

    revalidatePath("/permintaan");
    return { success: true, instruksi: instruksiPicker };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: error.message || "Gagal memproses approval." };
  }
}