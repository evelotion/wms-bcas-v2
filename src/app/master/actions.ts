"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Fungsi Tarik Data
export async function getMasterBarang() {
  try {
    return await prisma.master_Barang.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Gagal menarik data:", error);
    return [];
  }
}

// Fungsi Tambah Data
export async function createMasterBarang(formData: FormData) {
  try {
    await prisma.master_Barang.create({
      data: {
        sku: formData.get("sku") as string,
        nama: formData.get("nama") as string,
        kategori: formData.get("kategori") as string,
        satuan: formData.get("satuan") as string,
        batas_minimum: parseInt(formData.get("batas_minimum") as string) || 0,
      },
    });
    
    // Refresh otomatis halaman /master setelah data masuk
    revalidatePath("/master");
    return { success: true };
  } catch (error) {
    console.error("Gagal menyimpan data:", error);
    return { success: false, error: "Gagal menyimpan data. Pastikan SKU unik." };
  }
}