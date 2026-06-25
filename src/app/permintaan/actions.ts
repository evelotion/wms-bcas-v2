// src/app/permintaan/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Tarik data Master Barang untuk Dropdown
export async function getPermintaanFormData() {
  const barang = await prisma.master_Barang.findMany({ orderBy: { nama: 'asc' } });
  return { barang };
}

// Tarik daftar form yang masuk (Status DRAFT)
export async function getDaftarPermintaan() {
  return await prisma.permintaan_Header.findMany({
    where: { status: 'DRAFT' }, 
    include: {
      details: { include: { barang: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

// Bikin form permintaan manual
export async function createPermintaan(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const cabang = formData.get("cabang") as string;
    const pic_nama = formData.get("pic_nama") as string;
    const barangId = formData.get("barangId") as string;
    const qty = parseInt(formData.get("qty") as string);
    const keterangan = formData.get("keterangan") as string;
    
    // Generate nomor FPP dummy untuk input manual
    const dummyFpp = `MANUAL-FPP-${Date.now()}`;

    await prisma.permintaan_Header.create({
      data: {
        nomor_fpp: dummyFpp,
        cabang,
        pic_nama,
        status: 'DRAFT', 
        keterangan,
        details: {
          create: {
            barangId,
            qty_diminta: qty,
            status_item: 'OUTSTANDING'
          }
        }
      }
    });

    revalidatePath("/permintaan");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "Terjadi kesalahan saat membuat form." };
  }
}

// ==============================================================
// CORE ENGINE: Approve, Generate FPKB, & Split Outstanding
// ==============================================================
export async function approvePermintaan(headerId: string): Promise<{ success: boolean; instruksi?: string[]; nomor_fpkb?: string; error?: string }> {
  try {
    let generatedFpkb = "";
    let instruksi: string[] = [];

    await prisma.$transaction(async (tx) => {
      const header = await tx.permintaan_Header.findUnique({
        where: { id: headerId },
        include: { details: { include: { barang: true } } }
      });

      if (!header) throw new Error("Data form FPP tidak ditemukan!");
      if (header.status !== 'DRAFT') throw new Error("Form ini sudah diproses sebelumnya!");

      // 1. GENERATE NOMOR FPKB (Contoh: 00001/FPKB-CTK/LOG/2026)
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

      // 2. PROSES POTONG STOK & SPLIT OUTSTANDING
      for (const detail of header.details) {
        let qtyNeeded = detail.qty_diminta;
        let qtyDapat = 0;

        // FIFO Logic: Cari barang yang siap diambil
        const availableBatches = await tx.batch_Barang.findMany({
          where: {
            barangId: detail.barangId,
            qty_sisa: { gt: 0 }, // <--- INI FIX NYA BRO (Pakai 'gt' bukan '>')
            status: 'AVAILABLE'
          },
          orderBy: { tanggal_masuk: 'asc' },
          include: { lokasi: true }
        });

        for (const batch of availableBatches) {
          if (qtyNeeded <= 0) break;

          const potong = Math.min(batch.qty_sisa, qtyNeeded);
          qtyNeeded -= potong;
          qtyDapat += potong;

          const sisaDiRak = batch.qty_sisa - potong;

          // Kurangi stok fisik di rak & Update status jadi DEPLETED kalau habis
          await tx.batch_Barang.update({
            where: { id: batch.id },
            data: { 
              qty_sisa: sisaDiRak,
              status: sisaDiRak <= 0 ? 'DEPLETED' : 'AVAILABLE' 
            }
          });

          instruksi.push(`Ambil ${potong} ${detail.barang.satuan} [${detail.barang.sku}] dari Rak ${batch.lokasi.lorong}-${batch.lokasi.rak}`);

          // Catat di Ledger sebagai stok yang di-Booking (RESERVED)
          await tx.mutasi_Ledger.create({
            data: {
              batchId: batch.id,
              tipe_mutasi: 'OUTBOUND',
              qty_perubahan: potong,
              saldo_akhir: sisaDiRak,
              referensi: generatedFpkb, // Menggunakan nomor FPKB resmi
              keterangan: `RESERVED untuk Cabang ${header.cabang}`,
              createdBy: 'SYSTEM_SPV'
            }
          });
        }

        // 3. TENTUKAN STATUS AKHIR ITEM
        let finalStatusItem: 'FULFILLED' | 'PARTIAL' | 'OUTSTANDING' = 'FULFILLED';
        
        if (qtyNeeded > 0) {
          finalStatusItem = qtyDapat > 0 ? 'PARTIAL' : 'OUTSTANDING';
          
          // THE MAGIC: Lempar sisa barang yang nggak ke-cover ke tabel Outstanding
          await tx.permintaan_Outstanding.create({
            data: {
              headerId: header.id,
              barangId: detail.barangId,
              qty_sisa: qtyNeeded,
              status: 'OUTSTANDING'
            }
          });
        }

        // Update jumlah yang berhasil disanggupi gudang
        await tx.permintaan_Detail.update({
          where: { id: detail.id },
          data: {
            qty_disetujui: qtyDapat,
            status_item: finalStatusItem
          }
        });
      }

      // 4. KUNCI DOKUMEN FPKB
      await tx.permintaan_Header.update({
        where: { id: headerId },
        data: {
          status: 'RESERVED',
          nomor_fpkb: generatedFpkb
        }
      });
    });

    revalidatePath("/permintaan");
    return { success: true, instruksi, nomor_fpkb: generatedFpkb };
  } catch (error: any) {
    console.error("Gagal Approve:", error);
    return { success: false, error: error?.message || "Gagal memproses persetujuan." };
  }
}