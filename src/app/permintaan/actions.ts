"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getNextSequenceNumber } from "@/lib/sequence";

export async function getPermintaanFormData() {
  const barang = await prisma.master_Barang.findMany({ orderBy: { nama: 'asc' } });
  return { barang };
}

// STAF: Ambil daftar semua FPP (buat dashboard Staf - lihat status keseluruhan tiap FPP)
export async function getDaftarFpp(): Promise<any[]> {
  return await prisma.permintaan_Header.findMany({
    include: {
      details: { include: { barang: true } },
      fpkbs: { include: { items: true } },
      outstandings: { where: { status: 'OUTSTANDING' } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// STAF: Input FPP dari PDF email Cabang. FPP ini LANGSUNG jadi FPKB pertamanya
// (nomor FPP & nomor FPKB sama-sama digenerate di sini, sesuai alur: "FPP pure
// berubah jadi FPKB, yang proses itu Staf").
export async function createFppBaru(
  headerData: { cabang: string; wilayah: 'JABODETABEK' | 'NON_JABODETABEK'; pic_nama?: string; keterangan?: string },
  detailsData: { barangId: string; qty: number }[],
  adminId?: string
) {
  try {
    if (detailsData.length === 0) {
      throw new Error("Minimal 1 barang harus diisi.");
    }

    const nomorFpp = await getNextSequenceNumber("FPP");
    const nomorFpkb = await getNextSequenceNumber("FPKB");

    const header = await prisma.permintaan_Header.create({
      data: {
        nomor_fpp: nomorFpp,
        cabang: headerData.cabang,
        wilayah: headerData.wilayah,
        pic_nama: headerData.pic_nama || null,
        keterangan: headerData.keterangan || null,
        status: 'OPEN',
        adminId: adminId || null,
        details: {
          create: detailsData.map((d) => ({
            barangId: d.barangId,
            qty_diminta: d.qty,
            qty_terpenuhi: 0,
            status_item: 'OUTSTANDING',
          })),
        },
        fpkbs: {
          create: {
            nomor_fpkb: nomorFpkb,
            status: 'MENUNGGU_ADJUSTMENT',
            items: {
              create: detailsData.map((d) => ({
                barangId: d.barangId,
                qty_diminta: d.qty,
                qty_realisasi: 0,
                status_item: 'OUTSTANDING',
              })),
            },
          },
        },
      },
      include: { fpkbs: true },
    });

    revalidatePath("/permintaan");
    revalidatePath("/fpkb");
    return { success: true, nomor_fpp: nomorFpp, nomor_fpkb: nomorFpkb, headerId: header.id };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menyimpan FPP baru." };
  }
}

// STAF: Tutup permanen sisa outstanding (nggak dilanjutkan). Ini keputusan bisnis
// Staf, bukan Admin Gudang.
export async function tutupOutstanding(outstandingIds: string[]) {
  try {
    await prisma.$transaction(async (tx: any) => {
      for (const id of outstandingIds) {
        const os = await tx.permintaan_Outstanding.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });
        // Kalau semua outstanding di FPP ini udah nggak ada yang OUTSTANDING lagi -> CLOSED
        const sisaOutstanding = await tx.permintaan_Outstanding.count({
          where: { headerId: os.headerId, status: 'OUTSTANDING' },
        });
        if (sisaOutstanding === 0) {
          await tx.permintaan_Header.update({
            where: { id: os.headerId },
            data: { status: 'CLOSED' },
          });
        }
      }
    });
    revalidatePath("/permintaan");
    revalidatePath("/outstanding");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menutup outstanding." };
  }
}

// STAF: Terbitkan FPKB baru buat nutupin outstanding yang dipilih (masih terikat FPP asal)
export async function prosesUlangOutstanding(outstandingIds: string[]) {
  try {
    if (outstandingIds.length === 0) throw new Error("Pilih minimal 1 barang outstanding.");

    const outstandingRows = await prisma.permintaan_Outstanding.findMany({
      where: { id: { in: outstandingIds }, status: 'OUTSTANDING' },
    });
    if (outstandingRows.length === 0) throw new Error("Barang outstanding tidak ditemukan / sudah diproses.");

    // Pastikan semua dari FPP yang sama (1 FPKB baru = 1 FPP)
    const headerIds = new Set(outstandingRows.map((o) => o.headerId));
    if (headerIds.size > 1) throw new Error("Outstanding yang dipilih harus dari FPP yang sama.");
    const headerId = outstandingRows[0].headerId;

    const nomorFpkb = await getNextSequenceNumber("FPKB");

    const result = await prisma.$transaction(async (tx: any) => {
      const newFpkb = await tx.fpkb.create({
        data: {
          nomor_fpkb: nomorFpkb,
          headerId,
          status: 'MENUNGGU_ADJUSTMENT',
          items: {
            create: outstandingRows.map((o) => ({
              barangId: o.barangId,
              qty_diminta: o.qty_sisa,
              qty_realisasi: 0,
              status_item: 'OUTSTANDING',
            })),
          },
        },
      });

      for (const o of outstandingRows) {
        await tx.permintaan_Outstanding.update({
          where: { id: o.id },
          data: { fpkbLanjutanId: newFpkb.id },
        });
      }

      return newFpkb;
    });

    revalidatePath("/permintaan");
    revalidatePath("/outstanding");
    revalidatePath("/fpkb");
    return { success: true, nomor_fpkb: result.nomor_fpkb, fpkbId: result.id };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menerbitkan FPKB baru." };
  }
}
