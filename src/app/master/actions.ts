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

export async function getMasterBarangStats() {
  const semua = await prisma.master_Barang.findMany({
    select: {
      id: true,
      batches: { select: { harga_satuan: true } },
    },
  });
  const perluSetupHarga = semua.filter(
    (b) => !b.batches.some((bt) => bt.harga_satuan > 0)
  ).length;
  return { perluSetupHarga };
}

export async function createMasterBarang(formData: FormData) {
  try {
    await prisma.master_Barang.create({
      data: {
        sku: formData.get("sku") as string,
        nama: formData.get("nama") as string,
        kategori: formData.get("kategori") as string,
        satuan: formData.get("satuan") as string,
        satuan_besar: (formData.get("satuan_besar") as string) || null,
        isi_per_satuan_besar: Number(formData.get("isi_per_satuan_besar")) || 1,
        minimum_order_besar: formData.get("minimum_order_besar")
          ? Number(formData.get("minimum_order_besar"))
          : null,
        batas_minimum: Number(formData.get("batas_minimum")),
        kode_gl: (formData.get("kode_gl") as string) || null,
        keterangan_gl: (formData.get("keterangan_gl") as string) || null,
      },
    });
    revalidatePath("/master");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Gagal membuat barang baru." };
  }
}

export async function updateMasterBarang(id: string, formData: FormData) {
  try {
    await prisma.master_Barang.update({
      where: { id },
      data: {
        sku: formData.get("sku") as string,
        nama: formData.get("nama") as string,
        kategori: formData.get("kategori") as string,
        satuan: formData.get("satuan") as string,
        satuan_besar: (formData.get("satuan_besar") as string) || null,
        isi_per_satuan_besar: Number(formData.get("isi_per_satuan_besar")) || 1,
        minimum_order_besar: formData.get("minimum_order_besar")
          ? Number(formData.get("minimum_order_besar"))
          : null,
        batas_minimum: Number(formData.get("batas_minimum")),
        kode_gl: (formData.get("kode_gl") as string) || null,
        keterangan_gl: (formData.get("keterangan_gl") as string) || null,
      },
    });
    revalidatePath("/master");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Gagal mengupdate barang." };
  }
}