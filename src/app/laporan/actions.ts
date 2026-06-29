"use server";

import prisma from "@/lib/prisma";

export async function getLaporanData(bulan: string) {
  let dateFilter = {};
  
  if (bulan !== "all") {
    const [year, month] = bulan.split("-");
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
    dateFilter = { createdAt: { gte: startDate, lte: endDate } };
  }

  // 1. Laporan Stok Terkini
  const masterBarang = await prisma.master_Barang.findMany({
    include: { batches: true },
    orderBy: { nama: 'asc' }
  });
  
  type BarangWithBatches = (typeof masterBarang)[number];
  const persediaan = masterBarang.map((b: BarangWithBatches) => ({
    "Kode / SKU": b.sku,
    "Nama Barang": b.nama,
    "Satuan": b.satuan,
    "Batas Minimum": b.batas_minimum,
    "Sisa Stok Terkini": b.batches.reduce((sum, batch) => sum + batch.qty_sisa, 0),
  }));

  // 2. Laporan Barang Masuk (INBOUND)
  const riwayatMasuk = await prisma.mutasi_Ledger.findMany({
    where: { tipe_mutasi: 'INBOUND', ...dateFilter },
    include: { batch: { include: { barang: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const laporanMasuk = riwayatMasuk.map(m => ({
    "Tanggal Masuk": m.createdAt.toLocaleString('id-ID'),
    "Kode / SKU": m.batch.barang.sku,
    "Nama Barang": m.batch.barang.nama,
    "Qty Masuk": m.qty_perubahan,
    "Referensi / PO": m.referensi,
    "Supplier": m.batch.supplier || '-',
    "Nomorator / Seri": m.batch.nomorator || '-', // <-- INI YANG BIKIN ERROR SEBELUMNYA
    "Keterangan": m.keterangan || '-'
  }));

  // 3. Laporan Barang Keluar (OUTBOUND)
  const riwayatKeluar = await prisma.mutasi_Ledger.findMany({
    where: { tipe_mutasi: 'OUTBOUND', ...dateFilter },
    include: { batch: { include: { barang: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const laporanKeluar = riwayatKeluar.map(m => ({
    "Tanggal Keluar": m.createdAt.toLocaleString('id-ID'),
    "Kode / SKU": m.batch.barang.sku,
    "Nama Barang": m.batch.barang.nama,
    "Qty Keluar": Math.abs(m.qty_perubahan),
    "Tujuan / Referensi FPKB": m.referensi,
    "Keterangan": m.keterangan || '-',
    "Batch Pengurang": m.batch.tanggal_masuk.toLocaleDateString('id-ID')
  }));

  return { persediaan, laporanMasuk, laporanKeluar };
}