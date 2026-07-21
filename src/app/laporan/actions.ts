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

  const persediaan = masterBarang.map((b) => {
    const totalStok = b.batches.reduce((sum, batch) => sum + batch.qty_sisa, 0);
    return {
      "Kode / SKU": b.sku,
      "Nama Barang": b.nama,
      "Satuan": b.satuan,
      "Batas Minimum": b.batas_minimum,
      "Sisa Stok Terkini": totalStok,
    };
  });

  // 2. Laporan Barang Masuk (INBOUND)
  const riwayatMasuk = await prisma.mutasi_Ledger.findMany({
    where: { tipe_mutasi: 'INBOUND', ...dateFilter },
    include: { batch: { include: { barang: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const laporanMasuk = riwayatMasuk.map((m) => {
    const nomorator = m.batch.nomorator_awal && m.batch.nomorator_akhir
      ? `${m.batch.nomorator_awal} - ${m.batch.nomorator_akhir}`
      : (m.batch.nomorator_awal || m.batch.nomorator_akhir || '-');

    return {
      "Tanggal Masuk": m.createdAt.toLocaleString('id-ID'),
      "Kode / SKU": m.batch.barang.sku,
      "Nama Barang": m.batch.barang.nama,
      "Qty Masuk": m.qty_perubahan,
      "Referensi / PO": m.referensi || '-',
      "Supplier": m.batch.supplier || '-',
      "Nomorator / Seri": nomorator,
      "Keterangan": m.keterangan || '-'
    };
  });

  // 3. Laporan Barang Keluar (OUTBOUND)
  const riwayatKeluar = await prisma.mutasi_Ledger.findMany({
    where: { tipe_mutasi: 'OUTBOUND', ...dateFilter },
    include: { batch: { include: { barang: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const laporanKeluar = riwayatKeluar.map((m) => ({
    "Tanggal Keluar": m.createdAt.toLocaleString('id-ID'),
    "Kode / SKU": m.batch.barang.sku,
    "Nama Barang": m.batch.barang.nama,
    "Qty Keluar": Math.abs(m.qty_perubahan),
    "Tujuan / Referensi FPKB": m.referensi || '-',
    "Keterangan": m.keterangan || '-',
    "Batch Pengurang": m.batch.tanggal_masuk.toLocaleDateString('id-ID')
  }));

  return { persediaan, laporanMasuk, laporanKeluar };
}

export async function getStockOpname() {
  const master = await prisma.master_Barang.findMany({
    include: {
      batches: {
        where: { qty_sisa: { gt: 0 } },
        orderBy: { tanggal_masuk: "asc" }, // FIFO: batch tertua = tingkat harga ke-1
      },
    },
    orderBy: [{ kode_gl: "asc" }, { sku: "asc" }],
  });

  // ---- DETAIL: satu baris per tingkat harga FIFO ----
  const detail: any[] = [];
  for (const b of master) {
    const isiBesar = b.isi_per_satuan_besar || 1;
    const jmlTingkat = b.batches.length;
    b.batches.forEach((batch, idx) => {
      const qtyKecil = batch.qty_sisa;
      const nilai = qtyKecil * batch.harga_satuan;
      detail.push({
        "Kategori": b.kategori ?? "",
        "Kode GL": b.kode_gl ?? "",
        "Keterangan GL": b.keterangan_gl ?? "",
        "Kode / SKU": b.sku,
        "Nama Barang": b.nama,
        "Tingkat Harga ke-": idx + 1,
        "Jml Tingkat Aktif": jmlTingkat,
        "Qty (Satuan Kecil)": qtyKecil,
        "Satuan Kecil": b.satuan,
        "Qty (Satuan Besar)": isiBesar > 1 ? qtyKecil / isiBesar : qtyKecil,
        "Satuan Besar": b.satuan_besar ?? b.satuan,
        "Harga Satuan (Rp)": batch.harga_satuan,
        "Nilai Stok (Rp)": nilai,
        "Tanggal Masuk": batch.tanggal_masuk.toLocaleDateString("id-ID"),
      });
    });
  }

  // ---- RINGKASAN: subtotal per Kode GL ----
  const perGl = new Map<string, { kategori: string; kodeGl: string; ket: string; skuSet: Set<string>; nilai: number }>();
  for (const b of master) {
    const totalStok = b.batches.reduce((s, bt) => s + bt.qty_sisa, 0);
    const nilaiSku = b.batches.reduce((s, bt) => s + bt.qty_sisa * bt.harga_satuan, 0);
    const key = b.kode_gl ?? "(tanpa GL)";
    if (!perGl.has(key)) {
      perGl.set(key, { kategori: b.kategori ?? "", kodeGl: b.kode_gl ?? "", ket: b.keterangan_gl ?? "", skuSet: new Set(), nilai: 0 });
    }
    const g = perGl.get(key)!;
    if (totalStok > 0) g.skuSet.add(b.sku);
    g.nilai += nilaiSku;
  }

  const ringkasan = Array.from(perGl.values())
    .sort((a, b) => a.kodeGl.localeCompare(b.kodeGl))
    .map((g) => ({
      "Kategori": g.kategori,
      "Kode GL": g.kodeGl,
      "Keterangan": g.ket,
      "Jml SKU ber-stok": g.skuSet.size,
      "Nilai Stok (Rp)": g.nilai,
    }));

  // Baris TOTAL
  const totalSku = ringkasan.reduce((s, r) => s + (r["Jml SKU ber-stok"] as number), 0);
  const totalNilai = ringkasan.reduce((s, r) => s + (r["Nilai Stok (Rp)"] as number), 0);
  ringkasan.push({
    "Kategori": "",
    "Kode GL": "",
    "Keterangan": "TOTAL",
    "Jml SKU ber-stok": totalSku,
    "Nilai Stok (Rp)": totalNilai,
  });

  return { detail, ringkasan, totalSku, totalNilai };
}
