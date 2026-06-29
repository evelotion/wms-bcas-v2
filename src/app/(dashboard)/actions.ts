"use server";

import prisma from "@/lib/prisma";

export async function getDashboardStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 1. Total SKU Aktif
  const totalSku = await prisma.master_Barang.count();

  // 2. Total Inbound (Bulan Ini)
  const inboundMutations = await prisma.mutasi_Ledger.aggregate({
    where: { 
      tipe_mutasi: 'INBOUND',
      createdAt: { gte: startOfMonth }
    },
    _sum: { qty_perubahan: true }
  });
  const totalInbound = inboundMutations._sum.qty_perubahan || 0;

  // 3. Total Outbound (Bulan Ini) - diubah jadi positif karena di DB nyimpen negatif
  const outboundMutations = await prisma.mutasi_Ledger.aggregate({
    where: { 
      tipe_mutasi: 'OUTBOUND',
      createdAt: { gte: startOfMonth }
    },
    _sum: { qty_perubahan: true }
  });
  const totalOutbound = Math.abs(outboundMutations._sum.qty_perubahan || 0);

  // 4. Cek Stok Menipis (Hitung total sisa batch vs batas minimum)
  const semuaBarang = await prisma.master_Barang.findMany({
    include: { batches: { select: { qty_sisa: true } } }
  });

  // FIX: Tambahin ': any' dan ': number' di sini biar TypeScript nggak ngambek
  const lowStockAlerts = semuaBarang.map((b: any) => {
    const totalStok = b.batches.reduce((sum: number, batch: any) => sum + batch.qty_sisa, 0);
    return { ...b, totalStok };
  }).filter((b: any) => b.totalStok <= b.batas_minimum);

  return {
    totalSku,
    totalInbound,
    totalOutbound,
    lowStockCount: lowStockAlerts.length,
    lowStockAlerts: lowStockAlerts.slice(0, 5), // Ambil 5 teratas untuk list
  };
}