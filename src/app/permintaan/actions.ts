"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getPermintaanFormData() {
  const barang = await prisma.master_Barang.findMany({ orderBy: { nama: 'asc' } });
  return { barang };
}

export async function getDaftarPermintaan(): Promise<any[]> {
  return await prisma.permintaan_Header.findMany({
    where: { status: 'DRAFT' }, 
    include: { details: { include: { barang: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

// Tambahan buat narik data ke halaman Outstanding
export async function getOutstandingList(): Promise<any[]> {
  return await prisma.permintaan_Outstanding.findMany({
    where: { status: 'OUTSTANDING' },
    include: { barang: true, header: true },
    orderBy: { createdAt: 'desc' }
  });
}

// Approve dengan Adjustment Nominal / Hapus Item
export async function approvePermintaan(
  headerId: string, 
  adjustments: { detailId: string, qtyDisetujui: number }[] // Data dari UI
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
      if (header.status !== 'DRAFT') throw new Error("Form ini sudah diproses!");

      // 1. GENERATE NOMOR FPKB (Format: 00001/FPKB-CTK/LOG/2026)
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

      // 2. PROSES POTONG STOK SESUAI ADJUSTMENT
      for (const detail of header.details) {
        // Cari angka yang disetujui dari UI (kalau dihapus berarti 0)
        const adj = adjustments.find(a => a.detailId === detail.id);
        const qtyApproved = adj ? adj.qtyDisetujui : detail.qty_diminta;
        
        let qtyToProcess = qtyApproved;
        let qtyDapat = 0;
        
        // --- TAMBAHAN LOGIC HARGA ---
        let totalHargaSistem = 0; 

        // Cuma cari stok kalau qty disetujui > 0
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
            
            // Kalkulasi total harga dari batch yang kepotong
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
                keterangan: `RESERVED untuk Cabang ${header.cabang}`, createdBy: 'SYSTEM_SPV'
              }
            });
          }
        }

        // 3. LEMPAR SISA KE OUTSTANDING (qty_diminta asli - qty yang berhasil didapat)
        const qtyNgutang = detail.qty_diminta - qtyDapat;
        let finalStatusItem: 'FULFILLED' | 'PARTIAL' | 'OUTSTANDING' = 'FULFILLED';
        
        if (qtyNgutang > 0) {
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

        // Hitung harga rata-rata (weighted average) dari batch yang digunakan
        const harga_satuan_aktual = qtyDapat > 0 ? totalHargaSistem / qtyDapat : 0;

        rawDetails.push({
          ...updatedDetail,
          harga_satuan: harga_satuan_aktual
        });
      }

      await tx.permintaan_Header.update({
        where: { id: headerId },
        data: { status: 'RESERVED', nomor_fpkb: generatedFpkb }
      });
    });

    revalidatePath("/permintaan");
    revalidatePath("/outstanding");
    return { success: true, instruksi, nomor_fpkb: generatedFpkb, rawDetails };
  } catch (error: any) {
    return { success: false, error: error?.message || "Gagal memproses persetujuan." };
  }
}

// Action 1 (Tahap 4): Eksekusi Pemenuhan Outstanding
export async function fulfillOutstanding(outstandingId: string, qtyFulfill: number) {
  try {
    let generatedFpkb = "";
    let rawDetails: any[] = [];
    let instruksi: string[] = [];

    await prisma.$transaction(async (tx) => {
      const outstanding = await tx.permintaan_Outstanding.findUnique({
        where: { id: outstandingId },
        include: { barang: true, header: true }
      });

      if (!outstanding || outstanding.status !== 'OUTSTANDING') {
        throw new Error("Data outstanding tidak valid atau sudah diselesaikan.");
      }

      if (qtyFulfill > outstanding.qty_sisa) {
        throw new Error("Qty yang dipenuhi melebihi sisa utang barang!");
      }

      // 1. Generate Nomor FPKB Baru khusus pemenuhan
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

      // 2. Potong Stok FIFO
      let qtyToProcess = qtyFulfill;
      let totalHargaSistem = 0;
      const availableBatches = await tx.batch_Barang.findMany({
        where: { barangId: outstanding.barangId, qty_sisa: { gt: 0 }, status: 'AVAILABLE' },
        orderBy: { tanggal_masuk: 'asc' },
        include: { lokasi: true }
      });

      for (const batch of availableBatches) {
        if (qtyToProcess <= 0) break;
        const potong = Math.min(batch.qty_sisa, qtyToProcess);
        qtyToProcess -= potong;

        totalHargaSistem += potong * (batch.harga_satuan || 0);

        const sisaDiRak = batch.qty_sisa - potong;
        await tx.batch_Barang.update({
          where: { id: batch.id },
          data: { qty_sisa: sisaDiRak, status: sisaDiRak <= 0 ? 'DEPLETED' : 'AVAILABLE' }
        });

        instruksi.push(`Ambil ${potong} ${outstanding.barang.satuan} [${outstanding.barang.sku}] dari Rak ${batch.lokasi.lorong}-${batch.lokasi.rak}`);

        await tx.mutasi_Ledger.create({
          data: {
            batchId: batch.id, tipe_mutasi: 'OUTBOUND', qty_perubahan: potong,
            saldo_akhir: sisaDiRak, referensi: generatedFpkb,
            keterangan: `PEMENUHAN OUTSTANDING FPP: ${outstanding.header.nomor_fpp}`, createdBy: 'SYSTEM_SPV'
          }
        });
      }

      if (qtyToProcess > 0) {
        throw new Error(`Stok gudang fisik tidak cukup! Kurang ${qtyToProcess} lagi.`);
      }

      // 3. Update Status Outstanding
      const sisaUtangBaru = outstanding.qty_sisa - qtyFulfill;
      await tx.permintaan_Outstanding.update({
        where: { id: outstandingId },
        data: {
          qty_sisa: sisaUtangBaru,
          status: sisaUtangBaru === 0 ? 'FULFILLED' : 'OUTSTANDING'
        }
      });

      // Hitung harga rata-rata (weighted average) dari batch yang digunakan
      const harga_satuan_aktual = qtyFulfill > 0 ? totalHargaSistem / qtyFulfill : 0;
      const totalHarga = harga_satuan_aktual * qtyFulfill;

      // Siapkan data untuk dikirim ke fungsi generate PDF
      rawDetails.push({
        barang: outstanding.barang,
        qty_disetujui: qtyFulfill,
        harga_satuan: harga_satuan_aktual,
        total: totalHarga
      });
      
    });

    revalidatePath("/outstanding");
    return { success: true, nomor_fpkb: generatedFpkb, rawDetails, instruksi };
  } catch (error: any) {
    return { success: false, error: error?.message || "Gagal memproses pemenuhan." };
  }
}

// Action 2 (Tahap 4): Batal Outstanding
export async function cancelOutstanding(outstandingId: string) {
  try {
    await prisma.permintaan_Outstanding.update({
      where: { id: outstandingId },
      data: { status: 'CANCELLED', qty_sisa: 0 }
    });
    revalidatePath("/outstanding");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Gagal membatalkan data." };
  }
}

// Tambahkan di baris paling bawah src/app/permintaan/actions.ts

export async function createFppBaru(headerData: any, detailsData: { barangId: string, qty: number }[]) {
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
        status: 'DRAFT',
        details: {
          create: detailsData.map(d => ({
            barangId: d.barangId,
            qty_diminta: d.qty,
            qty_disetujui: 0,
            status_item: 'OUTSTANDING' // Status awal sebelum di-approve
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