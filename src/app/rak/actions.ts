"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getLokasiRak() {
  try {
    return await prisma.lokasi_Rak.findMany({
      orderBy: [
        { gudang: 'asc' },
        { lorong: 'asc' },
        { rak: 'asc' }
      ],
    });
  } catch (error) {
    console.error("Gagal menarik data rak:", error);
    return [];
  }
}

export async function createLokasiRak(formData: FormData) {
  try {
    const gudang = formData.get("gudang") as string;
    const lorong = formData.get("lorong") as string;
    const rak = formData.get("rak") as string;
    
    // Generate QR String yang unik (Format: WMS-GUDANG-LORONG-RAK)
    const qr_string = `WMS-${gudang}-${lorong}-${rak}`.toUpperCase().replace(/\s+/g, '-');

    await prisma.lokasi_Rak.create({
      data: {
        gudang,
        lorong,
        rak,
        qr_code: qr_string,
      },
    });
    
    revalidatePath("/rak");
    return { success: true };
  } catch (error) {
    console.error("Gagal menyimpan lokasi:", error);
    return { success: false, error: "Gagal menyimpan. Pastikan kombinasi atau QR Code unik (belum terdaftar)." };
  }
}