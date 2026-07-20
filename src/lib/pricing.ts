import prisma from "@/lib/prisma";

export async function getHargaTerkiniBarang(barangId: string): Promise<number> {
  const batchTertua = await prisma.batch_Barang.findFirst({
    where: { barangId, qty_sisa: { gt: 0 }, status: 'AVAILABLE' },
    orderBy: { tanggal_masuk: 'asc' },
  });
  return batchTertua?.harga_satuan || 0;
}
