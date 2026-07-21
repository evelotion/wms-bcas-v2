"use server";

import prisma from "@/lib/prisma";
import * as permintaanActions from "@/app/permintaan/actions";

// Dipakai di dashboard STAF dan ADMIN GUDANG - keduanya lihat data yang sama,
// termasuk info FPP asal & FPKB yang menyebabkan outstanding ini muncul.
export async function getOutstandingList() {
  return await prisma.permintaan_Outstanding.findMany({
    where: { status: 'OUTSTANDING' },
    include: {
      barang: true,
      header: true,       // Info FPP asal (nomor_fpp, cabang, wilayah)
      fpkbAsal: true,      // FPKB yang bikin item ini outstanding
      fpkbLanjutan: true,  // Kalau udah diterbitkan FPKB susulan, ini nunjuk ke situ
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Delegasi ke permintaan/actions.ts biar 1 sumber logic aja (dipanggil dari sini
// oleh halaman /outstanding, tapi juga dipakai Staf dari halaman /permintaan). File
// "use server" di Next.js versi ini cuma boleh export async function, jadi nggak
// bisa re-export langsung - dibungkus wrapper async tipis.
export async function tutupOutstanding(outstandingIds: string[]) {
  return permintaanActions.tutupOutstanding(outstandingIds);
}

export async function prosesUlangOutstanding(outstandingIds: string[]) {
  return permintaanActions.prosesUlangOutstanding(outstandingIds);
}

// Nilai rupiah outstanding = Σ (qty_sisa x harga FIFO SKU, dari batch tanggal_masuk
// tertua yang masih punya qty_sisa > 0). SKU tanpa batch berstok dihitung harga 0.
export async function getNilaiOutstanding() {
  const outstanding = await prisma.permintaan_Outstanding.findMany({
    where: { status: "OUTSTANDING" },
    select: {
      qty_sisa: true,
      barang: {
        select: {
          batches: {
            where: { qty_sisa: { gt: 0 } },
            orderBy: { tanggal_masuk: "asc" },
            select: { harga_satuan: true },
            take: 1,
          },
        },
      },
    },
  });
  const nilaiOutstanding = outstanding.reduce((sum, o) => {
    const harga = o.barang?.batches?.[0]?.harga_satuan ?? 0;
    return sum + o.qty_sisa * harga;
  }, 0);
  return { nilaiOutstanding };
}
