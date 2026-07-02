"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getPermintaanFormData() {
  const barang = await prisma.master_Barang.findMany({ orderBy: { nama: 'asc' } });
  return { barang };
}

// 1. ADMIN & GUDANG: Ambil daftar yang masih nunggu diproses gudang
export async function getDaftarPermintaan(): Promise<any[]> {
  return await prisma.permintaan_Header.findMany({
    where: { status: 'PENDING_GUDANG' }, // Disesuaikan dengan Enum Baru
    include: { details: { include: { barang: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

// 2. GUDANG: Ambil daftar utang barang
export async function getOutstandingList(): Promise<any[]> {
  return await prisma.permintaan_Outstanding.findMany({
    where: { status: 'OUTSTANDING' },
    include: { barang: true, header: true },
    orderBy: { createdAt: 'desc' }
  });
}

// 3. ADMIN: Simpan form PDF jadi Draft (PENDING_GUDANG)
export async function createFppBaru(headerData: any, detailsData: { barangId: string, qty: number }[], adminId?: string) {
  try {
    const existing = await prisma.permintaan_Header.findUnique({
      where: { nomor_fpp: headerData.nomor_fpp }
    });

    if (existing) {
      throw new Error("Nomor FPP ini sudah pernah diinput sebelumnya!");
    }

    await prisma.permintaan_Header.create({
      data: {
        nomor_fpp: headerData.nomor_fpp,
        cabang: headerData.cabang,
        pic_nama: headerData.pic_nama,
        status: 'PENDING_GUDANG', // Disesuaikan Enum Baru
        adminId: adminId || null, // Tracking siapa adminnya
        details: {
          create: detailsData.map(d => ({
            barangId: d.barangId,
            qty_diminta: d.qty,
            qty_disetujui: 0,
            status_item: 'OUTSTANDING'
          }))
        }
      }
    });

    revalidatePath("/permintaan");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menyimpan FPP Baru." };
  }
}

// 4. GUDANG: Eksekusi / Approve Permintaan
export async function approvePermintaan(
  headerId: string, 
  adjustments: { detailId: string, qtyDisetujui: number }[],
  gudangId?: string
): Promise<{ success: boolean; instruksi?: string[]; nomor_fpkb?: string; error?: string; rawDetails?: any[] }> {
  try {
    let generatedFpkb = "";
    let instruksi: string[] = [];
    let rawDetails: any[] = [];

    await prisma.$transaction(async (tx: any) => {
      const header = await tx.permintaan_Header.findUnique({
        where: { id: headerId },
        include: { details: { include: { barang: true } } }
      });

      if (!header) throw new Error("Data form FPP tidak ditemukan!");
      if (header.status !== 'PENDING_GUDANG') throw new Error("Form ini sudah diproses!");

      // GENERATE NOMOR FPKB
      const currentYear = new Date().getFullYear();
      const lastReq = await tx.permintaan_Header.findFirst({
        where: { nomor_fpkb: { endsWith: `/FPKB-CTK/LOG/${currentYear}` } },
        orderBy: { nomor_fpkb: 'desc' }
      });

      let nextNum = 1;
      if (lastReq && lastReq.nomor_fpkb) {
        nextNum = parseInt(lastReq.nomor_fpkb.split('/')[0]) + 1;
      }
      generatedFpkb = `${String(nextNum).padStart(5, '0')}/FPKB-CTK/LOG/${currentYear}`;

      let adaYangNgutang = false; // Flag penentu status akhir FPKB

      // PROSES POTONG STOK SESUAI ADJUSTMENT
      for (const detail of header.details) {
        const adj = adjustments.find(a => a.detailId === detail.id);
        const qtyApproved = adj ? adj.qtyDisetujui : detail.qty_diminta;
        
        let qtyToProcess = qtyApproved;
        let qtyDapat = 0;
        let totalHargaSistem = 0; 

        if (qtyToProcess > 0) {
          const availableBatches = await tx.batch_Barang.findMany({
            where: { barangId: detail.barangId, qty_sisa: { gt: 0 }, status: 'AVAILABLE' },
            orderBy: { tanggal_masuk: 'asc' },
            include: { lokasi: true }
          });

          for (const batch of availableBatches) {
            if (qtyToProcess <= 0) break;
            const potong = Math.min(batch.qty_sisa, qtyToProcess);
            qtyToProcess -= potong;
            qtyDapat += potong;
            totalHargaSistem += potong * (batch.harga_satuan || 0);

            const sisaDiRak = batch.qty_sisa - potong;
            await tx.batch_Barang.update({
              where: { id: batch.id },
              data: { qty_sisa: sisaDiRak, status: sisaDiRak <= 0 ? 'DEPLETED' : 'AVAILABLE' }
            });

            instruksi.push(`Ambil ${potong} ${detail.barang.satuan} [${detail.barang.sku}] dari Rak ${batch.lokasi.lorong}-${batch.lokasi.rak}`);

            await tx.mutasi_Ledger.create({
              data: {
                batchId: batch.id, tipe_mutasi: 'OUTBOUND', qty_perubahan: potong,
                saldo_akhir: sisaDiRak, referensi: generatedFpkb,
                keterangan: `RESERVED untuk Cabang ${header.cabang}`, createdBy: gudangId || 'SYSTEM_GUDANG'
              }
            });
          }
        }

        // LEMPAR SISA KE OUTSTANDING
        const qtyNgutang = detail.qty_diminta - qtyDapat;
        let finalStatusItem: 'FULFILLED' | 'PARTIAL' | 'OUTSTANDING' = 'FULFILLED';
        
        if (qtyNgutang > 0) {
          adaYangNgutang = true;
          finalStatusItem = qtyDapat > 0 ? 'PARTIAL' : 'OUTSTANDING';
          
          await tx.permintaan_Outstanding.create({
            data: {
              headerId: header.id,
              barangId: detail.barangId,
              qty_sisa: qtyNgutang,
              status: 'OUTSTANDING'
            }
          });
        }

        const updatedDetail = await tx.permintaan_Detail.update({
          where: { id: detail.id },
          data: { qty_disetujui: qtyDapat, status_item: finalStatusItem },
          include: { barang: true }
        });

        const harga_satuan_aktual = qtyDapat > 0 ? totalHargaSistem / qtyDapat : 0;
        rawDetails.push({ ...updatedDetail, harga_satuan: harga_satuan_aktual });
      }

      // UPDATE STATUS HEADER (Kalau ada yg ngutang jadi PARTIAL, kalau lengkap COMPLETED)
      const finalStatusHeader = adaYangNgutang ? 'PARTIAL' : 'COMPLETED';

      await tx.permintaan_Header.update({
        where: { id: headerId },
        data: { 
          status: finalStatusHeader, 
          nomor_fpkb: generatedFpkb,
          gudangId: gudangId || null
        }
      });
    });

    revalidatePath("/permintaan");
    revalidatePath("/outstanding");
    return { success: true, instruksi, nomor_fpkb: generatedFpkb, rawDetails };
  } catch (error: any) {
    return { success: false, error: error?.message || "Gagal memproses persetujuan." };
  }
}