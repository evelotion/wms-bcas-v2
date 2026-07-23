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

  // 3. Total Outbound (Bulan Ini) - qty_perubahan OUTBOUND tidak konsisten tandanya
  // (seed historis negatif, transaksi live positif), jadi _sum lalu Math.abs bisa salah
  // kalau campuran. Ambil per baris, abs-kan masing-masing, baru dijumlah.
  const outboundMutations = await prisma.mutasi_Ledger.findMany({
    where: {
      tipe_mutasi: 'OUTBOUND',
      createdAt: { gte: startOfMonth }
    },
    select: { qty_perubahan: true }
  });
  const totalOutbound = outboundMutations.reduce((sum, m) => sum + Math.abs(m.qty_perubahan), 0);

  // 4. Cek Stok Menipis (Hitung total sisa batch vs batas minimum)
  const semuaBarang = await prisma.master_Barang.findMany({
    include: { batches: { select: { qty_sisa: true } } }
  });

  const lowStockAlerts = semuaBarang.map(b => {
    const totalStok = b.batches.reduce((sum, batch) => sum + batch.qty_sisa, 0);
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

// === ALERT UNTUK ALUR FPP -> FPKB ===
// Dipanggil dari dashboard, dipakai baik oleh Staf maupun Admin Gudang (role beda,
// filter tampilan beda, tapi datanya dari sini semua).
export async function getFpkbAlerts() {
  // 1. Outstanding yang sekarang stoknya udah cukup buat diproses ulang (restock alert)
  const outstandingList = await prisma.permintaan_Outstanding.findMany({
    where: { status: 'OUTSTANDING' },
    include: { barang: { include: { batches: { select: { qty_sisa: true } } } }, header: true },
  });

  const outstandingBisaDiproses = outstandingList
    .map((o) => {
      const totalStokSekarang = o.barang.batches.reduce((sum, b) => sum + b.qty_sisa, 0);
      return { ...o, totalStokSekarang };
    })
    .filter((o: any) => o.totalStokSekarang >= o.qty_sisa);

  // 2. FPKB yang udah di-adjustment tapi dokumen serah terima belum diupload
  const fpkbBelumSerahTerima = await prisma.fpkb.findMany({
    where: { status: 'MENUNGGU_SERAH_TERIMA' },
    include: { header: true },
    orderBy: { updatedAt: 'asc' },
  });

  // 3. FPKB baru yang belum di-adjustment sama sekali (antrean Admin Gudang)
  const fpkbMenungguAdjustment = await prisma.fpkb.count({
    where: { status: 'MENUNGGU_ADJUSTMENT' },
  });

  return {
    outstandingBisaDiprosesCount: outstandingBisaDiproses.length,
    outstandingBisaDiproses: outstandingBisaDiproses.slice(0, 10),
    fpkbBelumSerahTerimaCount: fpkbBelumSerahTerima.length,
    fpkbBelumSerahTerima: fpkbBelumSerahTerima.slice(0, 10),
    fpkbMenungguAdjustmentCount: fpkbMenungguAdjustment,
  };
}

// === GLOBAL SEARCH NAVBAR ===
export async function searchBarang(q: string) {
  const query = q.trim();
  if (query.length < 2) return [];
  const hasil = await prisma.master_Barang.findMany({
    where: {
      OR: [
        { sku: { contains: query, mode: "insensitive" } },
        { nama: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, sku: true, nama: true, kategori: true },
    take: 8,
    orderBy: { sku: "asc" },
  });
  return hasil;
}