import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const pool = new Pool({ connectionString: connectionString! });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

// 18 SKU yang ada stok di sistem lama tapi TIDAK ada di sheet Buku_Besar -> di-skip (keputusan Fase 3A #4)
const SKIP_SKU = new Set([
  'PRO-142', 'PRO-Tumbler', 'BRG-005', 'BRG-006', 'BRG-009', 'BRG-100', 'BRG-101', 'BRG-103',
  'IDSS-509', 'IDSS-911', 'SDBS-705-NJ', 'PRO-004', 'PRO-044', 'PRO-115', 'PRO-121', 'PRO-123',
  'PRO-133', 'PRO-138', 'PRO-139',
]);

const HARGA_EPSILON = 0.5;
const warnings: string[] = [];

// ==== Helpers ====

function cleanStr(raw: unknown): string {
  return raw !== undefined && raw !== null ? raw.toString().trim() : '';
}

// Angka format Excel apa adanya ("1,442,301" -> 1442301, "23,000.00" -> 23000)
function parseUSNumber(raw: unknown): number {
  const s = cleanStr(raw);
  if (!s || s === '-') return 0;
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseLeadingInt(raw: unknown): number {
  const s = cleanStr(raw);
  const match = s.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// Format sheet: "DD-Mon-YY" (mis. "12-Jun-26"). Return undefined kalau format tidak dikenali
// (mis. sel rusak seperti IDSS-712 = " 4 ") -> caller WAJIB treat sebagai skip, jangan menebak.
function parseGLDate(raw: unknown): Date | undefined {
  const s = cleanStr(raw);
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return undefined;
  const mon = MONTHS[m[2]];
  if (mon === undefined) return undefined;
  const day = parseInt(m[1], 10);
  const year = 2000 + parseInt(m[3], 10);
  return new Date(Date.UTC(year, mon, day));
}

type BukuBesarRow = Record<string, string>;
type FifoRow = Record<string, string>;

type BatchRec = {
  id: string;
  harga: number;
  qtyAwal: number;
  qtySisa: number;
  tanggalMasuk: Date;
};

async function main() {
  console.log('Memulai Seed v2 - Migrasi Buku Besar Gabungan (Fase 3C)...\n');

  const xlsxPath = path.join(process.cwd(), 'Buku_Besar_Update_GL_FIFO.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.error(`File ${xlsxPath} tidak ditemukan!`);
    process.exit(1);
  }
  const wb = XLSX.readFile(xlsxPath);
  const bukuBesar: BukuBesarRow[] = XLSX.utils.sheet_to_json(wb.Sheets['Buku_Besar'], { defval: '', raw: false });
  const fifoStok: FifoRow[] = XLSX.utils.sheet_to_json(wb.Sheets['Harga_FIFO_Stok_Aktif'], { defval: '', raw: false });

  // ==== STEP 0: WIPE (urutan penting karena FK constraint) ====
  console.log('[Step 0] Wipe data lama...');
  await prisma.permintaan_Header.deleteMany({});
  await prisma.mutasi_Ledger.deleteMany({});
  await prisma.item_Seri.deleteMany({});
  await prisma.batch_Barang.deleteMany({});
  await prisma.master_Barang.deleteMany({});
  console.log('  Selesai. (Sequence_Counter & User TIDAK di-wipe)\n');

  const lokasiHistori = await prisma.lokasi_Rak.upsert({
    where: { qr_code: 'WMS-TRANSIT-HISTORI-01' },
    update: {},
    create: { gudang: 'TRANSIT', lorong: 'HISTORI', rak: '01', qr_code: 'WMS-TRANSIT-HISTORI-01' },
  });

  // ==== STEP 1: Build peta GL & konversi satuan, upsert Master_Barang ====
  console.log('[Step 1] Build Master_Barang dari sheet Buku_Besar...');

  type SkuMeta = {
    barangId: string;
    nama: string;
    kategori: string;
    kodeGl: string;
    keteranganGl: string;
    satuanBesar: string;
    satuan: string;
    isiPerSatuanBesar: number;
  };
  const skuMetaMap = new Map<string, SkuMeta>();
  const seenSku = new Set<string>();
  let masterCount = 0;
  let skippedSkuCount = 0;

  for (const row of bukuBesar) {
    const kode = cleanStr(row['Kode Barang']);
    if (!kode) continue;
    if (SKIP_SKU.has(kode)) {
      if (!seenSku.has(kode)) {
        skippedSkuCount++;
        seenSku.add(kode);
      }
      continue;
    }
    if (seenSku.has(kode)) continue; // hanya baris kemunculan pertama per SKU
    seenSku.add(kode);

    const nama = cleanStr(row['Nama Barang']);
    const kategori = cleanStr(row['Kategori GL']) || 'Tanpa Kategori';
    const kodeGl = cleanStr(row['Kode GL']).replace(/,/g, '');
    const keteranganGl = cleanStr(row['Keterangan GL']);
    const satuanBesar = cleanStr(row['Unit Stock Opname']) || cleanStr(row['Satuan']) || 'Pcs';
    const satuan = cleanStr(row['Satuan']) || 'Pcs';
    const isiPerSatuanBesar = parseInt(cleanStr(row['Jumlah / Unit Serah Terima']).replace(/,/g, ''), 10) || 1;
    const minOrderBesar = parseLeadingInt(row['Minimum Order / Unit']);

    const barang = await prisma.master_Barang.upsert({
      where: { sku: kode },
      update: {
        nama, kategori, satuan, satuan_besar: satuanBesar,
        isi_per_satuan_besar: isiPerSatuanBesar,
        minimum_order_besar: minOrderBesar || null,
        kode_gl: kodeGl || null,
        keterangan_gl: keteranganGl || null,
      },
      create: {
        sku: kode, nama, kategori, satuan, satuan_besar: satuanBesar,
        isi_per_satuan_besar: isiPerSatuanBesar,
        minimum_order_besar: minOrderBesar || null,
        kode_gl: kodeGl || null,
        keterangan_gl: keteranganGl || null,
      },
    });

    skuMetaMap.set(kode, {
      barangId: barang.id, nama, kategori, kodeGl, keteranganGl,
      satuanBesar, satuan, isiPerSatuanBesar,
    });
    masterCount++;
  }
  console.log(`  Master_Barang dibuat/diupdate: ${masterCount} SKU (skip: ${skippedSkuCount} SKU sistem-only)\n`);

  // ==== STEP 2: Batch_Barang dari sheet Harga_FIFO_Stok_Aktif ====
  console.log('[Step 2] Build Batch_Barang dari sheet Harga_FIFO_Stok_Aktif...');

  const batchesBySku = new Map<string, BatchRec[]>();
  let batchCount = 0;
  let openingInboundCount = 0;

  // Urutkan dulu berdasarkan SKU + Tingkat Harga ke- supaya lot lama diproses duluan
  const fifoSorted = [...fifoStok].sort((a, b) => {
    const skuCmp = cleanStr(a['Kode Barang']).localeCompare(cleanStr(b['Kode Barang']));
    if (skuCmp !== 0) return skuCmp;
    return parseUSNumber(a['Tingkat Harga ke-']) - parseUSNumber(b['Tingkat Harga ke-']);
  });

  for (const row of fifoSorted) {
    const kode = cleanStr(row['Kode Barang']);
    if (!kode) continue; // baris TOTAL di akhir sheet
    if (cleanStr(row['Ada di Buku Besar']) === 'Tidak') continue;
    if (SKIP_SKU.has(kode)) continue;
    const meta = skuMetaMap.get(kode);
    if (!meta) {
      warnings.push(`SKU ${kode} ada di Harga_FIFO_Stok_Aktif tapi tidak ditemukan di Master_Barang (Buku_Besar) - baris FIFO di-skip.`);
      continue;
    }

    const qty = parseUSNumber(row['Qty Stock (satuan kecil)']);
    const harga = parseUSNumber(row['Harga Satuan (Rp)']);
    const tingkatHargaKe = parseUSNumber(row['Tingkat Harga ke-']) || 1;

    // Cari baris Buku_Besar SKU yang sama dengan harga mendekati (epsilon 0.5) utk ambil tanggal_masuk & nomorator asli
    let tanggalMasuk: Date;
    let nomoratorAwal = '-';
    let nomoratorAkhir = '-';
    const match = bukuBesar.find((r) => {
      if (cleanStr(r['Kode Barang']) !== kode) return false;
      const hargaRow = parseUSNumber(r['Harga Barang / Satuan (Rp)']);
      if (hargaRow === 0) return false;
      if (Math.abs(hargaRow - harga) >= HARGA_EPSILON) return false;
      return parseGLDate(r['Tanggal Masuk']) !== undefined;
    });

    if (match) {
      tanggalMasuk = parseGLDate(match['Tanggal Masuk'])!;
      nomoratorAwal = cleanStr(match['Awal ']) || '-';
      nomoratorAkhir = cleanStr(match['Akhir']) || '-';
    } else {
      // Fallback tanggal snapshot sintetis: 2026-07-01 + offset tingkat harga (tingkat 1 = tertua)
      tanggalMasuk = new Date(Date.UTC(2026, 6, 1, 0, 0, 0, (tingkatHargaKe - 1) * 1000));
    }

    const batch = await prisma.batch_Barang.create({
      data: {
        barangId: meta.barangId,
        lokasiId: lokasiHistori.id,
        tanggal_masuk: tanggalMasuk,
        qty_awal: qty,
        qty_sisa: qty,
        harga_satuan: harga,
        supplier: '-',
        nomorator_awal: nomoratorAwal,
        nomorator_akhir: nomoratorAkhir,
        status: 'AVAILABLE',
      },
    });

    await prisma.mutasi_Ledger.create({
      data: {
        batchId: batch.id,
        tipe_mutasi: 'INBOUND',
        qty_perubahan: qty,
        saldo_akhir: qty,
        referensi: 'Saldo Awal Migrasi Buku Besar v2',
        createdBy: 'SYSTEM_SEED_V2',
        createdAt: tanggalMasuk,
      },
    });

    const rec: BatchRec = { id: batch.id, harga, qtyAwal: qty, qtySisa: qty, tanggalMasuk };
    const list = batchesBySku.get(kode) || [];
    list.push(rec);
    list.sort((a, b) => a.tanggalMasuk.getTime() - b.tanggalMasuk.getTime());
    batchesBySku.set(kode, list);

    batchCount++;
    openingInboundCount++;
  }
  console.log(`  Batch_Barang dibuat: ${batchCount} (Mutasi_Ledger INBOUND opening: ${openingInboundCount})\n`);

  // ==== STEP 3: Replay mutasi Juli 2026 ====
  console.log('[Step 3] Replay mutasi Juli 2026...');

  const num = (v: unknown) => parseUSNumber(v);

  type MutEntry = { row: BukuBesarRow; tipe: 'IN' | 'OUT'; effectiveDate: Date };
  const julyEntries: MutEntry[] = [];

  for (const row of bukuBesar) {
    const kode = cleanStr(row['Kode Barang']);
    const barangMasuk = num(row['Barang Masuk']);
    const barangKeluar = num(row['Barang Keluar']);
    if (barangMasuk <= 0 && barangKeluar <= 0) continue;

    const tipe: 'IN' | 'OUT' = barangKeluar > 0 ? 'OUT' : 'IN';
    const dateRaw = tipe === 'OUT' ? row['Tanggal Keluar'] : row['Tanggal Masuk'];
    const parsed = parseGLDate(dateRaw);

    if (!parsed) {
      warnings.push(
        `SKU ${kode}: baris mutasi ${tipe === 'OUT' ? 'keluar' : 'masuk'} punya tanggal tidak valid (${JSON.stringify(cleanStr(dateRaw))}) - DISKIP dari replay Juli. Perbaiki sel tanggal di Excel lalu jalankan ulang seed.`
      );
      continue;
    }
    if (parsed.getUTCFullYear() === 2026 && parsed.getUTCMonth() === 6) {
      julyEntries.push({ row, tipe, effectiveDate: parsed });
    }
  }

  julyEntries.sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());

  let julyInboundCount = 0;
  let julyOutboundCount = 0;
  let julyInboundValue = 0;
  let julyOutboundValue = 0;

  for (const entry of julyEntries) {
    const { row, tipe, effectiveDate } = entry;
    const kode = cleanStr(row['Kode Barang']);
    const meta = skuMetaMap.get(kode);
    if (!meta) {
      warnings.push(`SKU ${kode}: ada mutasi Juli tapi SKU tidak ada di Master_Barang (kemungkinan masuk daftar skip) - baris di-skip.`);
      continue;
    }
    const batches = batchesBySku.get(kode) || [];

    if (tipe === 'OUT') {
      // Barang Masuk/Keluar di sheet Buku_Besar tercatat dalam SATUAN BESAR (Pack/Box, sama
      // seperti Stock Awal/Sisa Stock - dibuktikan oleh aritmetika baris itu sendiri: Sisa Stock
      // = Stock Awal/Sisa Stock sebelumnya +/- Barang Masuk/Keluar TANPA konversi apa pun).
      // Batch_Barang.qty_sisa & Mutasi_Ledger tersimpan dalam satuan KECIL -> wajib dikonversi.
      const barangKeluar = num(row['Barang Keluar']) * meta.isiPerSatuanBesar;
      const harga = num(row['Harga Barang / Satuan (Rp)']);
      julyOutboundValue += barangKeluar * harga;
      julyOutboundCount++;

      const nomorDokumen = cleanStr(row['Nomor Dokumen']) || cleanStr(row['No FPKB']) || '-';
      const namaCabang = cleanStr(row['Nama Cabang/Unit Kerja']);
      const picCabang = cleanStr(row['PIC Cabang/Unit Kerja']);
      const keterangan = [namaCabang, picCabang ? `PIC: ${picCabang}` : ''].filter(Boolean).join(' - ');
      const petugasGudang = cleanStr(row['Petugas Gudang']);

      let qtyToCut = barangKeluar;
      const availableBatches = batches.filter((b) => b.qtySisa > 0).sort((a, b) => a.tanggalMasuk.getTime() - b.tanggalMasuk.getTime());

      if (availableBatches.reduce((s, b) => s + b.qtySisa, 0) < qtyToCut) {
        warnings.push(
          `SKU ${kode}: stok batch tersedia (${availableBatches.reduce((s, b) => s + b.qtySisa, 0)}) kurang dari qty outbound Juli (${qtyToCut}) pada baris ${nomorDokumen} tgl ${row['Tanggal Keluar']} - kemungkinan stok sudah habis dipotong mutasi sebelumnya. FIFO tetap dijalankan sampai batch habis.`
        );
      }

      for (const batch of availableBatches) {
        if (qtyToCut <= 0) break;
        const potong = Math.min(batch.qtySisa, qtyToCut);
        qtyToCut -= potong;
        batch.qtySisa -= potong;

        await prisma.batch_Barang.update({
          where: { id: batch.id },
          data: { qty_sisa: batch.qtySisa, status: batch.qtySisa <= 0 ? 'DEPLETED' : 'AVAILABLE' },
        });

        await prisma.mutasi_Ledger.create({
          data: {
            batchId: batch.id,
            tipe_mutasi: 'OUTBOUND',
            qty_perubahan: -potong,
            saldo_akhir: batch.qtySisa,
            referensi: nomorDokumen,
            keterangan: keterangan || null,
            createdBy: petugasGudang || 'SYSTEM_SEED_V2',
            createdAt: effectiveDate,
          },
        });
      }
    } else {
      // Sama seperti OUTBOUND: Barang Masuk di sheet tercatat satuan BESAR -> konversi ke kecil.
      const barangMasuk = num(row['Barang Masuk']) * meta.isiPerSatuanBesar;
      const harga = num(row['Harga Barang / Satuan (Rp)']);
      julyInboundValue += barangMasuk * harga;
      julyInboundCount++;

      const nomorDokumen = cleanStr(row['Nomor Dokumen']) || '-';
      const nomoratorAwal = cleanStr(row['Awal ']) || '-';
      const nomoratorAkhir = cleanStr(row['Akhir']) || '-';

      const sortedAsc = [...batches].sort((a, b) => a.tanggalMasuk.getTime() - b.tanggalMasuk.getTime());
      const termuda = sortedAsc[sortedAsc.length - 1];

      if (termuda && Math.abs(termuda.harga - harga) < HARGA_EPSILON) {
        termuda.qtySisa += barangMasuk;
        termuda.qtyAwal += barangMasuk;
        await prisma.batch_Barang.update({
          where: { id: termuda.id },
          data: { qty_awal: { increment: barangMasuk }, qty_sisa: { increment: barangMasuk }, status: 'AVAILABLE' },
        });
        await prisma.mutasi_Ledger.create({
          data: {
            batchId: termuda.id,
            tipe_mutasi: 'INBOUND',
            qty_perubahan: barangMasuk,
            saldo_akhir: termuda.qtySisa,
            referensi: nomorDokumen,
            createdBy: 'SYSTEM_SEED_V2',
            createdAt: effectiveDate,
          },
        });
      } else {
        const newBatch = await prisma.batch_Barang.create({
          data: {
            barangId: meta.barangId,
            lokasiId: lokasiHistori.id,
            tanggal_masuk: effectiveDate,
            qty_awal: barangMasuk,
            qty_sisa: barangMasuk,
            harga_satuan: harga,
            supplier: '-',
            nomorator_awal: nomoratorAwal,
            nomorator_akhir: nomoratorAkhir,
            status: 'AVAILABLE',
          },
        });
        await prisma.mutasi_Ledger.create({
          data: {
            batchId: newBatch.id,
            tipe_mutasi: 'INBOUND',
            qty_perubahan: barangMasuk,
            saldo_akhir: barangMasuk,
            referensi: nomorDokumen,
            createdBy: 'SYSTEM_SEED_V2',
            createdAt: effectiveDate,
          },
        });
        const rec: BatchRec = { id: newBatch.id, harga, qtyAwal: barangMasuk, qtySisa: barangMasuk, tanggalMasuk: effectiveDate };
        batches.push(rec);
        batches.sort((a, b) => a.tanggalMasuk.getTime() - b.tanggalMasuk.getTime());
        batchesBySku.set(kode, batches);
      }
    }
  }
  console.log(`  Mutasi Juli di-replay: ${julyInboundCount} inbound, ${julyOutboundCount} outbound\n`);

  // ==== STEP 4: Rekonsiliasi ====
  console.log('[Step 4] Rekonsiliasi...\n');

  const allBatches = await prisma.batch_Barang.findMany();
  const totalNilaiStok = allBatches.reduce((sum, b) => sum + b.qty_sisa * b.harga_satuan, 0);

  const netOutflowJuli = julyOutboundValue - julyInboundValue;
  const targetAwal = 982691570.5;
  const targetSetelahReplay = targetAwal - netOutflowJuli;

  console.log('=== REKONSILIASI TOTAL NILAI ===');
  console.log(`  Total nilai baseline Ringkasan sheet (118 SKU, termasuk 18 SKU skip): Rp ${targetAwal.toLocaleString('id-ID', { minimumFractionDigits: 2 })}`);
  console.log(`  Total value July OUTBOUND: Rp ${julyOutboundValue.toLocaleString('id-ID', { minimumFractionDigits: 2 })}`);
  console.log(`  Total value July INBOUND : Rp ${julyInboundValue.toLocaleString('id-ID', { minimumFractionDigits: 2 })}`);
  console.log(`  Net outflow Juli: Rp ${netOutflowJuli.toLocaleString('id-ID', { minimumFractionDigits: 2 })}`);
  console.log(`  Target (baseline - net outflow Juli): Rp ${targetSetelahReplay.toLocaleString('id-ID', { minimumFractionDigits: 2 })}`);
  console.log(`  Total nilai stok AKTUAL di DB sekarang : Rp ${totalNilaiStok.toLocaleString('id-ID', { minimumFractionDigits: 2 })}`);
  console.log(`  Selisih vs target: Rp ${(totalNilaiStok - targetSetelahReplay).toLocaleString('id-ID', { minimumFractionDigits: 2 })}`);
  console.log(`  (Catatan: baseline 982.691.570,50 mencakup 118 SKU termasuk 18 SKU sistem-only yang di-skip dari seed ini -`);
  console.log(`   jadi selisih di atas SEBAGIAN diharapkan berasal dari nilai stok 18 SKU tsb, bukan murni error migrasi.)\n`);

  // Rekonsiliasi qty per-SKU: qty DB vs Sisa Stock TERAKHIR di Buku_Besar (dikonversi ke satuan kecil)
  // Catatan: kolom "Sisa Stock" TIDAK selalu terisi di baris mutasi terbaru (ditemukan 10 baris kosong
  // walau ada Barang Masuk/Keluar) - jadi nilai "terakhir" dihitung sbg running balance per SKU
  // (pakai angka Sisa Stock kalau terisi, kalau kosong turunkan dari runningPrev + masuk - keluar),
  // bukan literal ambil sel baris terakhir yang bisa saja kosong.
  const rowsBySku = new Map<string, BukuBesarRow[]>();
  for (const row of bukuBesar) {
    const kode = cleanStr(row['Kode Barang']);
    if (!kode || SKIP_SKU.has(kode)) continue;
    const list = rowsBySku.get(kode) || [];
    list.push(row);
    rowsBySku.set(kode, list);
  }
  const lastSisaStockBySku = new Map<string, number>();
  for (const [kode, skuRows] of rowsBySku) {
    let running: number | undefined;
    for (const row of skuRows) {
      const sisaRaw = cleanStr(row['Sisa Stock']);
      const stockAwalRaw = cleanStr(row['Stock Awal']);
      const masuk = num(row['Barang Masuk']);
      const keluar = num(row['Barang Keluar']);
      if (sisaRaw !== '') {
        running = num(sisaRaw);
      } else if (running !== undefined) {
        running = running + masuk - keluar;
      } else if (stockAwalRaw !== '') {
        running = num(stockAwalRaw) + masuk - keluar;
      }
    }
    lastSisaStockBySku.set(kode, running ?? 0);
  }

  console.log('=== REKONSILIASI QTY PER-SKU ===');
  console.log('SKU'.padEnd(14) + 'Qty DB'.padStart(10) + 'Qty Buku Besar (kecil)'.padStart(26) + 'Selisih'.padStart(12));

  const selisihList: { sku: string; qtyDb: number; qtyBB: number; selisih: number }[] = [];
  let selisihNonZeroCount = 0;

  const allSkus = [...skuMetaMap.keys()].sort();
  for (const sku of allSkus) {
    const meta = skuMetaMap.get(sku)!;
    const batches = batchesBySku.get(sku) || [];
    const qtyDb = batches.reduce((s, b) => s + b.qtySisa, 0);
    const sisaStockBB = lastSisaStockBySku.get(sku) ?? 0;
    const qtyBB = sisaStockBB * meta.isiPerSatuanBesar;
    const selisih = qtyDb - qtyBB;
    selisihList.push({ sku, qtyDb, qtyBB, selisih });
    if (selisih !== 0) selisihNonZeroCount++;
    console.log(sku.padEnd(14) + String(qtyDb).padStart(10) + String(qtyBB).padStart(26) + String(selisih).padStart(12));
  }

  console.log(`\n  Total SKU dicek: ${allSkus.length} | Selisih = 0: ${allSkus.length - selisihNonZeroCount} | Selisih != 0: ${selisihNonZeroCount}\n`);

  if (selisihNonZeroCount > 0) {
    console.log('=== WARNING: SKU DENGAN SELISIH QTY != 0 ===');
    console.log('(Kemungkinan double-count mutasi Juli - snapshot sistem mungkin sudah menyerap sebagian transaksi awal Juli. Review manual.)');
    for (const s of selisihList.filter((x) => x.selisih !== 0)) {
      console.log(`  - ${s.sku}: DB=${s.qtyDb} | Buku Besar=${s.qtyBB} | selisih=${s.selisih > 0 ? '+' : ''}${s.selisih}`);
      warnings.push(`Rekonsiliasi qty ${s.sku}: DB=${s.qtyDb}, Buku Besar=${s.qtyBB}, selisih=${s.selisih}`);
    }
    console.log('');
  }

  // ==== Spot-check ====
  console.log('=== SPOT-CHECK ===');
  for (const sku of ['IDSS-508', 'IDSS-179', 'UMMS-501']) {
    const batches = batchesBySku.get(sku) || [];
    console.log(`  ${sku}: ${batches.length} batch`);
    batches.forEach((b, i) =>
      console.log(`    Lot ${i + 1}: qty_sisa=${b.qtySisa}, harga=${b.harga}, tanggal_masuk=${b.tanggalMasuk.toISOString().slice(0, 10)}`)
    );
  }
  console.log('');

  // ==== Ringkasan akhir ====
  const totalMasterBarang = await prisma.master_Barang.count();
  const totalBatchBarang = await prisma.batch_Barang.count();
  const totalMutasiOpening = await prisma.mutasi_Ledger.count({ where: { referensi: 'Saldo Awal Migrasi Buku Besar v2' } });
  const totalMutasiInboundJuli = await prisma.mutasi_Ledger.count({
    where: { tipe_mutasi: 'INBOUND', NOT: { referensi: 'Saldo Awal Migrasi Buku Besar v2' } },
  });
  const totalMutasiOutboundJuli = await prisma.mutasi_Ledger.count({ where: { tipe_mutasi: 'OUTBOUND' } });

  console.log('=== RINGKASAN AKHIR ===');
  console.log(`  Master_Barang       : ${totalMasterBarang}`);
  console.log(`  Batch_Barang        : ${totalBatchBarang}`);
  console.log(`  Mutasi_Ledger INBOUND (opening)   : ${totalMutasiOpening}`);
  console.log(`  Mutasi_Ledger INBOUND (Juli)      : ${totalMutasiInboundJuli}`);
  console.log(`  Mutasi_Ledger OUTBOUND (Juli)     : ${totalMutasiOutboundJuli}`);

  console.log(`\n=== WARNING / SKIP LOG (${warnings.length}) ===`);
  if (warnings.length === 0) {
    console.log('  (tidak ada)');
  } else {
    warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
  }

  console.log('\nSeed v2 selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
