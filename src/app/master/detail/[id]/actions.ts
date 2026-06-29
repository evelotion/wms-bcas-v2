"use server";

import prisma from "@/lib/prisma";

export async function getDetailBarangLengkap(id: string) {
  // 1. Ambil info Master Barang
  const barang = await prisma.master_Barang.findUnique({
    where: { id },
  });

  // 2. Hitung Total Stok dari Batch yang tersisa
  const batches = await prisma.batch_Barang.findMany({
    where: { barangId: id },
    include: { lokasi: true }
  });
  const totalStok = batches.reduce((sum, b) => sum + b.qty_sisa, 0);

  // 3. Tarik Log Riwayat Keluar-Masuk (Kartu Stok)
  const mutasi = await prisma.mutasi_Ledger.findMany({
    where: { batch: { barangId: id } },
    include: { batch: { include: { lokasi: true } } },
    orderBy: { createdAt: 'desc' },
    take: 30 // Tampilkan 30 transaksi terakhir
  });

  return { barang, totalStok, batches, mutasi };
}
