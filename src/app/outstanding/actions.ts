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
