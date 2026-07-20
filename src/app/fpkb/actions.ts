"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getNextSequenceNumber } from "@/lib/sequence";

// ADMIN GUDANG: Antrean FPKB yang belum di-adjustment
export async function getFpkbMenungguAdjustment(): Promise<any[]> {
  return await prisma.fpkb.findMany({
    where: { status: 'MENUNGGU_ADJUSTMENT' },
    include: { header: true, items: { include: { barang: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

// ADMIN GUDANG: FPKB yang udah di-adjustment tapi dokumen serah terima belum lengkap
// -> ini yang jadi basis alert "belum selesai serah terima"
export async function getFpkbMenungguSerahTerima(): Promise<any[]> {
  return await prisma.fpkb.findMany({
    where: { status: 'MENUNGGU_SERAH_TERIMA' },
    include: { header: true, items: { include: { barang: true } } },
    orderBy: { updatedAt: 'asc' },
  });
}

export async function getDetailFpkb(fpkbId: string) {
  return await prisma.fpkb.findUnique({
    where: { id: fpkbId },
    include: { header: true, items: { include: { barang: true } }, gudang: true },
  });
}

// ADMIN GUDANG: Proses adjustment - cek stok, tentuin realisasi per item, potong stok
// FIFO per batch (sama seperti logic lama), sisanya yang nggak kekejar jadi Outstanding.
export async function prosesAdjustmentFpkb(
  fpkbId: string,
  adjustments: { itemId: string; qtyRealisasi: number }[],
  gudangId?: string
): Promise<{ success: boolean; instruksi?: string[]; error?: string }> {
  try {
    let instruksi: string[] = [];

    await prisma.$transaction(async (tx: any) => {
      const fpkb = await tx.fpkb.findUnique({
        where: { id: fpkbId },
        include: { items: { include: { barang: true } }, header: true },
      });
      if (!fpkb) throw new Error("FPKB tidak ditemukan!");
      if (fpkb.status !== 'MENUNGGU_ADJUSTMENT') throw new Error("FPKB ini sudah diproses sebelumnya!");

      let masihAdaOutstanding = false;

      for (const item of fpkb.items) {
        const adj = adjustments.find((a) => a.itemId === item.id);
        const qtyDiminta = adj ? Math.min(adj.qtyRealisasi, item.qty_diminta) : item.qty_diminta;

        let qtyToProcess = qtyDiminta;
        let qtyDapat = 0;

        if (qtyToProcess > 0) {
          const availableBatches = await tx.batch_Barang.findMany({
            where: { barangId: item.barangId, qty_sisa: { gt: 0 }, status: 'AVAILABLE' },
            orderBy: { tanggal_masuk: 'asc' },
            include: { lokasi: true },
          });

          for (const batch of availableBatches) {
            if (qtyToProcess <= 0) break;
            const potong = Math.min(batch.qty_sisa, qtyToProcess);
            qtyToProcess -= potong;
            qtyDapat += potong;

            const sisaDiRak = batch.qty_sisa - potong;
            await tx.batch_Barang.update({
              where: { id: batch.id },
              data: { qty_sisa: sisaDiRak, status: sisaDiRak <= 0 ? 'DEPLETED' : 'AVAILABLE' },
            });

            instruksi.push(`Ambil ${potong} ${item.barang.satuan} [${item.barang.sku}] dari Rak ${batch.lokasi.lorong}-${batch.lokasi.rak}`);

            await tx.mutasi_Ledger.create({
              data: {
                batchId: batch.id,
                tipe_mutasi: 'OUTBOUND',
                qty_perubahan: potong,
                saldo_akhir: sisaDiRak,
                referensi: fpkb.nomor_fpkb,
                keterangan: `FPKB ${fpkb.nomor_fpkb} - ${fpkb.header.cabang}`,
                createdBy: gudangId || 'ADMIN_GUDANG',
              },
            });
          }
        }

        const qtyKurang = item.qty_diminta - qtyDapat;
        const statusItem = qtyKurang <= 0 ? 'FULFILLED' : qtyDapat > 0 ? 'PARTIAL' : 'OUTSTANDING';

        await tx.fpkb_Item.update({
          where: { id: item.id },
          data: { qty_realisasi: qtyDapat, status_item: statusItem },
        });

        // Akumulasi ke Permintaan_Detail (target keseluruhan FPP)
        const detail = await tx.permintaan_Detail.findFirst({
          where: { headerId: fpkb.headerId, barangId: item.barangId },
        });
        if (detail) {
          const totalTerpenuhi = detail.qty_terpenuhi + qtyDapat;
          await tx.permintaan_Detail.update({
            where: { id: detail.id },
            data: {
              qty_terpenuhi: totalTerpenuhi,
              status_item: totalTerpenuhi >= detail.qty_diminta ? 'FULFILLED' : totalTerpenuhi > 0 ? 'PARTIAL' : 'OUTSTANDING',
            },
          });
        }

        if (qtyKurang > 0) {
          masihAdaOutstanding = true;
          await tx.permintaan_Outstanding.create({
            data: {
              headerId: fpkb.headerId,
              fpkbAsalId: fpkb.id,
              barangId: item.barangId,
              qty_sisa: qtyKurang,
              status: 'OUTSTANDING',
            },
          });
        }
      }

      await tx.fpkb.update({
        where: { id: fpkbId },
        data: { status: 'MENUNGGU_SERAH_TERIMA', gudangId: gudangId || null },
      });

      // Kalau nggak ada outstanding baru DAN nggak ada outstanding lama yang masih nunggak -> FPP bisa CLOSED
      if (!masihAdaOutstanding) {
        const sisaOutstandingLain = await tx.permintaan_Outstanding.count({
          where: { headerId: fpkb.headerId, status: 'OUTSTANDING' },
        });
        if (sisaOutstandingLain === 0) {
          await tx.permintaan_Header.update({ where: { id: fpkb.headerId }, data: { status: 'CLOSED' } });
        }
      }
    });

    revalidatePath("/fpkb");
    revalidatePath("/outstanding");
    revalidatePath("/permintaan");
    return { success: true, instruksi };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memproses adjustment FPKB." };
  }
}

// ADMIN GUDANG: Upload dokumen serah terima. JABODETABEK cuma butuh FPKB signed.
// NON_JABODETABEK butuh FPKB signed + BAST signed + nomor airwaybill.
export async function uploadServahTerimaFpkb(
  fpkbId: string,
  data: { fileFpkbBase64: string; fileBastBase64?: string; nomorAirwaybill?: string }
) {
  try {
    const fpkb = await prisma.fpkb.findUnique({ where: { id: fpkbId }, include: { header: true } });
    if (!fpkb) throw new Error("FPKB tidak ditemukan!");
    if (fpkb.status !== 'MENUNGGU_SERAH_TERIMA') throw new Error("FPKB ini belum di-adjustment atau sudah selesai.");

    const isJabodetabek = fpkb.header.wilayah === 'JABODETABEK';

    if (!data.fileFpkbBase64) throw new Error("File FPKB yang sudah ditandatangani wajib diupload.");
    if (!isJabodetabek && !data.fileBastBase64) throw new Error("Wilayah NON_JABODETABEK wajib upload BAST juga.");
    if (!isJabodetabek && !data.nomorAirwaybill) throw new Error("Wilayah NON_JABODETABEK wajib isi nomor Airwaybill/resi.");

    let nomorBast: string | null = null;
    if (!isJabodetabek) {
      nomorBast = await getNextSequenceNumber("BAST");
    }

    await prisma.fpkb.update({
      where: { id: fpkbId },
      data: {
        file_fpkb_signed: data.fileFpkbBase64,
        file_bast_signed: data.fileBastBase64 || null,
        nomor_airwaybill: data.nomorAirwaybill || null,
        nomor_bast: nomorBast,
        tanggal_serah_terima: new Date(),
        status: 'SELESAI',
      },
    });

    revalidatePath("/fpkb");
    return { success: true, nomor_bast: nomorBast };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal upload dokumen serah terima." };
  }
}
