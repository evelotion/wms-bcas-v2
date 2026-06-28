"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getMasterBarang() {
  return await prisma.master_Barang.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  });
}

export async function createMasterBarang(formData: FormData) {
  try {
    await prisma.master_Barang.create({
      data: {
        sku: formData.get("sku") as string,
        nama: formData.get("nama") as string,
        kategori: formData.get("kategori") as string,
        satuan: formData.get("satuan") as string,
        batas_minimum: Number(formData.get("batas_minimum")),
      },
    });
    revalidatePath("/master");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Gagal membuat barang baru." };
  }
}