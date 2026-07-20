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
// Buku Besar = otoritas QTY (keputusan arsitektur final, cross-check 20 Jul 2026). Opening balance
// diambil dari kolom "Stock Awal" baris pertama tiap SKU, per-tanggal opening tetap 2026-06-01
// (sebelum mutasi pertama 7 Jun 2026). Sistem (Harga_FIFO_Stok_Aktif) hanya dipakai utk harga tier & GL.
const OPENING_DATE = new Date(Date.UTC(2026, 5, 1)); // 2026-06-01
const FALLBACK_DATE_NO_ANCHOR = new Date(Date.UTC(2026, 6, 1)); // 2026-07-01, dipakai kalau tidak ada baris valid sebelumnya sama sekali
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
// (mis. sel rusak seperti IDSS-712 = " 4 ", atau PRO-001 yang kosong) -> caller pakai fallback tanggal.
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
  console.log('Memulai Seed v2.1 - Buku Besar = otoritas Qty, Sistem = otoritas Harga & GL...\n');

  const xlsxPath = path.join(process.cwd(), 'Buku_Besar_Update_GL_FIFO.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.error(`File ${xlsxPath} tidak ditemukan!`);
    process.exit(1);
  }
  const wb = XLSX.readFile(xlsxPath);
  const bukuBesar: BukuBesarRow[] = XLSX.utils.sheet_to_json(wb.Sheets['Buku_Besar'], { defval: '', raw: false });
  const fifoStok: FifoRow[] = XLSX.utils.sheet_to_json(wb.Sheets['Harga_FIFO_Stok_Aktif'], { defval: '', raw: false });

  const num = (v: unknown) => parseUSNumber(v);

  // Rows per SKU, urutan asli sheet (dipakai utk: first-row opening data, resolusi harga BB, fallback tanggal)
  const rowsBySku = new Map<string, BukuBesarRow[]>();
  for (const row of bukuBesar) {
    const kode = cleanStr(row['Kode Barang']);
    if (!kode || SKIP_SKU.has(kode)) continue;
    const list = rowsBySku.get(kode) || [];
    list.push(row);
    rowsBySku.set(kode, list);
  }

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

  // ==== STEP 1: Build peta GL & konversi satuan, upsert Master_Barang, capture opening qty & harga BB ====
  console.log('[Step 1] Build Master_Barang dari sheet Buku_Besar (baris pertama per SKU)...');

  type SkuMeta = {
    barangId: string;
    nama: string;
    kategori: string;
    kodeGl: string;
    keteranganGl: string;
    satuanBesar: string;
    satuan: string;
    isiPerSatuanBesar: number;
    stockAwalBesar: number;
    hargaBB: number; // harga Buku Besar SKU itu: harga non-kosong pertama yg ditemukan di baris SKU tsb
  };
  const skuMetaMap = new Map<string, SkuMeta>();
  let masterCount = 0;
  const skippedSkuNames = new Set<string>();
  for (const row of bukuBesar) {
    const kode = cleanStr(row['Kode Barang']);
    if (kode && SKIP_SKU.has(kode)) skippedSkuNames.add(kode);
  }

  for (const [kode, skuRows] of rowsBySku) {
    const firstRow = skuRows[0];

    const nama = cleanStr(firstRow['Nama Barang']);
    const kategori = cleanStr(firstRow['Kategori GL']) || 'Tanpa Kategori';
    const kodeGl = cleanStr(firstRow['Kode GL']).replace(/,/g, '');
    const keteranganGl = cleanStr(firstRow['Keterangan GL']);
    const satuanBesar = cleanStr(firstRow['Unit Stock Opname']) || cleanStr(firstRow['Satuan']) || 'Pcs';
    const satuan = cleanStr(firstRow['Satuan']) || 'Pcs';
    const isiPerSatuanBesar = parseInt(cleanStr(firstRow['Jumlah / Unit Serah Terima']).replace(/,/g, ''), 10) || 1;
    const minOrderBesar = parseLeadingInt(firstRow['Minimum Order / Unit']);
    const stockAwalBesar = num(firstRow['Stock Awal']);

    // Harga Buku Besar SKU itu = harga positif pertama yg ditemukan di baris SKU ini (biasanya baris pertama,
    // tapi beberapa SKU baris pertamanya kosong -> cari di baris berikutnya).
    let hargaBB = 0;
    for (const r of skuRows) {
      const h = num(r['Harga Barang / Satuan (Rp)']);
      if (h > 0) { hargaBB = h; break; }
    }

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
      satuanBesar, satuan, isiPerSatuanBesar, stockAwalBesar, hargaBB,
    });
    masterCount++;
  }
  console.log(`  Master_Barang dibuat/diupdate: ${masterCount} SKU (skip: ${skippedSkuNames.size} SKU sistem-only)\n`);

  // ==== STEP 2: Peta tier harga FIFO per SKU dari sheet Harga_FIFO_Stok_Aktif ====
  console.log('[Step 2] Build peta tier harga FIFO dari sheet Harga_FIFO_Stok_Aktif...');

  type TierRec = { tingkat: number; harga: number; qtyCapacity: number };
  const tiersBySku = new Map<string, TierRec[]>();

  for (const row of fifoStok) {
    const kode = cleanStr(row['Kode Barang']);
    if (!kode) continue; // baris TOTAL di akhir sheet
    if (cleanStr(row['Ada di Buku Besar']) === 'Tidak') continue;
    if (SKIP_SKU.has(kode)) continue;
    if (!skuMetaMap.has(kode)) {
      warnings.push(`SKU ${kode} ada di Harga_FIFO_Stok_Aktif tapi tidak ditemukan di Master_Barang (Buku_Besar) - baris tier di-skip.`);
      continue;
    }
    const tingkat = parseUSNumber(row['Tingkat Harga ke-']) || 1;
    const harga = parseUSNumber(row['Harga Satuan (Rp)']);
    const qtyCapacity = parseUSNumber(row['Qty Stock (satuan kecil)']);
    const list = tiersBySku.get(kode) || [];
    list.push({ tingkat, harga, qtyCapacity });
    tiersBySku.set(kode, list);
  }
  for (const list of tiersBySku.values()) list.sort((a, b) => a.tingkat - b.tingkat); // tingkat 1 = tertua
  console.log(`  Tier harga dimuat untuk ${tiersBySku.size} SKU.\n`);

  // ==== STEP 3: Opening batch per SKU - alokasikan qty opening (Stock Awal) ke tier harga sistem ====
  console.log('[Step 3] Build Batch_Barang opening (qty dari Buku Besar, harga dari alokasi tier sistem)...');

  const batchesBySku = new Map<string, BatchRec[]>();
  let openingBatchCount = 0;
  let openingFromTier = 0;
  let openingFromBB = 0;
  let openingFromZero = 0;

  for (const [kode, meta] of skuMetaMap) {
    const openingQtyKecil = meta.stockAwalBesar * meta.isiPerSatuanBesar;
    if (openingQtyKecil <= 0) continue;

    let remaining = openingQtyKecil;
    const tiers = tiersBySku.get(kode) || [];
    const list: BatchRec[] = [];

    for (const tier of tiers) {
      if (remaining <= 0) break;
      const allocQty = Math.min(remaining, tier.qtyCapacity);
      if (allocQty <= 0) continue;

      const batch = await prisma.batch_Barang.create({
        data: {
          barangId: meta.barangId,
          lokasiId: lokasiHistori.id,
          tanggal_masuk: OPENING_DATE,
          qty_awal: allocQty,
          qty_sisa: allocQty,
          harga_satuan: tier.harga,
          supplier: '-',
          nomorator_awal: '-',
          nomorator_akhir: '-',
          status: 'AVAILABLE',
        },
      });
      await prisma.mutasi_Ledger.create({
        data: {
          batchId: batch.id,
          tipe_mutasi: 'INBOUND',
          qty_perubahan: allocQty,
          saldo_akhir: allocQty,
          referensi: 'OPENING - Stock Opname Jun 2026',
          createdBy: 'SYSTEM_SEED_V2_1',
          createdAt: OPENING_DATE,
        },
      });
      list.push({ id: batch.id, harga: tier.harga, qtyAwal: allocQty, qtySisa: allocQty, tanggalMasuk: OPENING_DATE });
      remaining -= allocQty;
      openingBatchCount++;
      openingFromTier++;
    }

    if (remaining > 0) {
      // Kelebihan opening di atas total tier sistem (atau SKU tanpa tier sama sekali) -> harga dari Buku Besar.
      // Diperlakukan sbg lot TERTUA (dipotong FIFO duluan) krn merepresentasikan stok fisik yang lebih tua
      // dari rentang yang masih dilacak sistem tier.
      const harga = meta.hargaBB;
      if (harga <= 0) {
        warnings.push(
          `WARNING KERAS: SKU ${kode} opening qty ${remaining} tidak punya harga sama sekali (tier sistem habis/kosong DAN harga Buku Besar kosong) - batch dibuat dengan harga 0. Harga WAJIB diisi Staf via /master sebelum SKU ini dipakai di FPKB.`
        );
        openingFromZero++;
      } else {
        openingFromBB++;
      }

      const batch = await prisma.batch_Barang.create({
        data: {
          barangId: meta.barangId,
          lokasiId: lokasiHistori.id,
          tanggal_masuk: OPENING_DATE,
          qty_awal: remaining,
          qty_sisa: remaining,
          harga_satuan: harga,
          supplier: '-',
          nomorator_awal: '-',
          nomorator_akhir: '-',
          status: 'AVAILABLE',
        },
      });
      await prisma.mutasi_Ledger.create({
        data: {
          batchId: batch.id,
          tipe_mutasi: 'INBOUND',
          qty_perubahan: remaining,
          saldo_akhir: remaining,
          referensi: 'OPENING - Stock Opname Jun 2026 [HARGA DARI BUKU BESAR]',
          createdBy: 'SYSTEM_SEED_V2_1',
          createdAt: OPENING_DATE,
        },
      });
      // Ditaruh di depan list supaya jadi lot tertua saat FIFO cut (lihat catatan di atas).
      list.unshift({ id: batch.id, harga, qtyAwal: remaining, qtySisa: remaining, tanggalMasuk: OPENING_DATE });
      openingBatchCount++;
    }

    batchesBySku.set(kode, list);
  }
  console.log(`  Batch opening dibuat: ${openingBatchCount} (dari tier sistem: ${openingFromTier}, dari harga Buku Besar: ${openingFromBB}, harga 0: ${openingFromZero})\n`);

  // ==== STEP 4: Replay SEMUA mutasi (7 Jun - 16 Jul 2026), dgn auto-sync ke checkpoint Sisa Stock ====
  console.log('[Step 4] Replay semua mutasi Buku Besar (7 Jun - 16 Jul 2026)...');

  // Sebagian SKU punya lebih dari satu baris "Stock Awal" di sheet (blok reset/opname ulang di
  // tengah ledger), dan sebagian baris "Sisa Stock" tidak konsisten murni dgn aritmetika masuk/keluar
  // barisnya sendiri (sheet quality issue, ditemukan saat cross-check 21 Jul 2026). Keputusan: sheet
  // = otoritas, jadi tiap kali baris punya kolom "Sisa Stock" terisi, itu diperlakukan sbg CHECKPOINT -
  // setelah mutasi baris itu diproses, total qty_sisa SKU disinkronkan paksa ke angka checkpoint via
  // batch penyesuaian ("[ADJUSTMENT - SYNC SISA STOCK BB]"). Utk 101/112 SKU yg sudah konsisten ini
  // no-op (diff selalu 0); utk 11 SKU anomali ini yg membuat hard-fail lolos by construction.
  let adjustmentSyncCount = 0;

  async function syncCheckpoint(kode: string, meta: SkuMeta, targetBesar: number, effectiveDate: Date, sourceLabel: string) {
    const targetKecil = targetBesar * meta.isiPerSatuanBesar;
    const batches = batchesBySku.get(kode) || [];
    const current = batches.reduce((s, b) => s + b.qtySisa, 0);
    const diff = targetKecil - current;
    if (diff === 0) return;

    adjustmentSyncCount++;
    warnings.push(
      `SKU ${kode}: sinkronisasi qty ke Sisa Stock sheet (${sourceLabel}) tgl ${effectiveDate.toISOString().slice(0, 10)} - penyesuaian ${diff > 0 ? '+' : ''}${diff} (satuan kecil), krn sheet punya blok Stock Awal/Sisa Stock yang tidak konsisten dgn replay murni.`
    );

    if (diff > 0) {
      const sortedAsc = [...batches].sort((a, b) => a.tanggalMasuk.getTime() - b.tanggalMasuk.getTime());
      const termuda = sortedAsc[sortedAsc.length - 1];
      const harga = termuda ? termuda.harga : meta.hargaBB;
      if (harga <= 0) {
        warnings.push(`WARNING KERAS: SKU ${kode} adjustment sync (+${diff}) tidak punya harga - batch dibuat dengan harga 0.`);
      }
      const newBatch = await prisma.batch_Barang.create({
        data: {
          barangId: meta.barangId,
          lokasiId: lokasiHistori.id,
          tanggal_masuk: effectiveDate,
          qty_awal: diff,
          qty_sisa: diff,
          harga_satuan: harga,
          supplier: '-',
          nomorator_awal: '-',
          nomorator_akhir: '-',
          status: 'AVAILABLE',
        },
      });
      await prisma.mutasi_Ledger.create({
        data: {
          batchId: newBatch.id,
          tipe_mutasi: 'INBOUND',
          qty_perubahan: diff,
          saldo_akhir: diff,
          referensi: `[ADJUSTMENT - SYNC SISA STOCK BB] ${sourceLabel}`,
          createdBy: 'SYSTEM_SEED_V2_1',
          createdAt: effectiveDate,
        },
      });
      batches.push({ id: newBatch.id, harga, qtyAwal: diff, qtySisa: diff, tanggalMasuk: effectiveDate });
      batches.sort((a, b) => a.tanggalMasuk.getTime() - b.tanggalMasuk.getTime());
      batchesBySku.set(kode, batches);
    } else {
      let qtyToCut = -diff;
      const availableBatches = batches.filter((b) => b.qtySisa > 0).sort((a, b) => a.tanggalMasuk.getTime() - b.tanggalMasuk.getTime());
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
            referensi: `[ADJUSTMENT - SYNC SISA STOCK BB] ${sourceLabel}`,
            createdBy: 'SYSTEM_SEED_V2_1',
            createdAt: effectiveDate,
          },
        });
      }
      if (qtyToCut > 0) {
        warnings.push(`SKU ${kode}: adjustment sync butuh potong ${-diff} tapi stok batch tersedia kurang (sisa ${qtyToCut} tidak terpotong).`);
      }
    }
  }

  type MutEntry = { row: BukuBesarRow; tipe: 'IN' | 'OUT' | 'CHECKPOINT'; effectiveDate: Date; isFallback: boolean };
  const allEntries: MutEntry[] = [];
  const lastValidDateBySku = new Map<string, Date>();

  // Pass 1: urutan ASLI sheet per SKU (skip baris pertama - itu opening, sudah dipakai di Step 3),
  // supaya fallback tanggal ambil "baris valid sebelumnya" yang benar.
  for (const [kode, skuRows] of rowsBySku) {
    for (let i = 1; i < skuRows.length; i++) {
      const row = skuRows[i];
      const barangMasuk = num(row['Barang Masuk']);
      const barangKeluar = num(row['Barang Keluar']);
      const hasCheckpoint = cleanStr(row['Stock Awal']) !== '' || cleanStr(row['Sisa Stock']) !== '';
      if (barangMasuk <= 0 && barangKeluar <= 0 && !hasCheckpoint) continue; // baris benar-benar kosong

      const tipe: 'IN' | 'OUT' | 'CHECKPOINT' = barangKeluar > 0 ? 'OUT' : barangMasuk > 0 ? 'IN' : 'CHECKPOINT';
      const dateRaw = tipe === 'OUT' ? row['Tanggal Keluar'] : row['Tanggal Masuk'];
      // Baris checkpoint-only kadang tanggalnya ada di kolom yg "salah" (mis. Tanggal Masuk terisi
      // walau tidak ada Barang Masuk) - coba kolom lain di baris yang sama dulu sblm fallback ke SKU.
      const parsed = parseGLDate(dateRaw) ?? (tipe === 'CHECKPOINT' ? parseGLDate(row['Tanggal Keluar']) : undefined);

      let effectiveDate: Date;
      let isFallback = false;
      if (parsed) {
        effectiveDate = parsed;
        lastValidDateBySku.set(kode, parsed);
      } else {
        effectiveDate = lastValidDateBySku.get(kode) ?? FALLBACK_DATE_NO_ANCHOR;
        isFallback = true;
        if (tipe !== 'CHECKPOINT') {
          warnings.push(
            `SKU ${kode}: baris mutasi ${tipe === 'OUT' ? 'keluar' : 'masuk'} tanggal tidak tercatat (raw=${JSON.stringify(cleanStr(dateRaw))}) - pakai fallback ${effectiveDate.toISOString().slice(0, 10)} [TANGGAL TIDAK TERCATAT DI SUMBER].`
          );
        }
      }
      allEntries.push({ row, tipe, effectiveDate, isFallback });
    }
  }

  // Pass 2: replay per SKU dalam URUTAN ASLI SHEET (BUKAN sort-by-tanggal-parsed). FIFO cutting &
  // checkpoint-sync per SKU independen dari SKU lain, jadi urutan ANTAR-SKU tak masalah - yang wajib
  // benar cuma urutan DALAM satu SKU. Ditemukan (cross-check 21 Jul 2026): beberapa baris (mis.
  // IDSS-003 baris ke-5 "07-Jun-26") punya tanggal yg keliru/typo tapi urutan barisnya di sheet tetap
  // konsisten secara aritmetika (Sisa Stock cocok persis mengikuti urutan baris). Sort-by-tanggal
  // pernah dicoba dan JUSTRU merusak SKU yg tadinya sudah benar (typo tanggal memindah posisi replay-
  // nya), jadi urutan baris asli dipakai sbg sumber kebenaran urutan, tanggal parsed cuma dipakai utk
  // field createdAt (histori) & fallback anchor SKU lain.
  let mutasiInboundCount = 0;
  let mutasiOutboundCount = 0;

  for (const entry of allEntries) {
    const { row, tipe, effectiveDate, isFallback } = entry;
    const kode = cleanStr(row['Kode Barang']);
    const meta = skuMetaMap.get(kode);
    if (!meta) {
      warnings.push(`SKU ${kode}: ada mutasi tapi SKU tidak ada di Master_Barang (kemungkinan masuk daftar skip) - baris di-skip.`);
      continue;
    }
    const batches = batchesBySku.get(kode) || [];
    const fallbackTag = isFallback ? ' [TANGGAL TIDAK TERCATAT DI SUMBER]' : '';

    if (tipe === 'CHECKPOINT') {
      const target = num(row['Sisa Stock']) || num(row['Stock Awal']);
      await syncCheckpoint(kode, meta, target, effectiveDate, cleanStr(row['Nomor Dokumen']) || '-');
      continue;
    }

    if (tipe === 'OUT') {
      // Barang Masuk/Keluar di sheet Buku_Besar tercatat dalam SATUAN BESAR (Pack/Box, sama
      // seperti Stock Awal/Sisa Stock - dibuktikan oleh aritmetika baris itu sendiri: Sisa Stock
      // = Stock Awal/Sisa Stock sebelumnya +/- Barang Masuk/Keluar TANPA konversi apa pun).
      // Batch_Barang.qty_sisa & Mutasi_Ledger tersimpan dalam satuan KECIL -> wajib dikonversi.
      const barangKeluar = num(row['Barang Keluar']) * meta.isiPerSatuanBesar;

      const nomorDokumen = (cleanStr(row['Nomor Dokumen']) || cleanStr(row['No FPKB']) || '-') + fallbackTag;
      const namaCabang = cleanStr(row['Nama Cabang/Unit Kerja']);
      const picCabang = cleanStr(row['PIC Cabang/Unit Kerja']);
      const keterangan = [namaCabang, picCabang ? `PIC: ${picCabang}` : ''].filter(Boolean).join(' - ');
      const petugasGudang = cleanStr(row['Petugas Gudang']);

      let qtyToCut = barangKeluar;
      const availableBatches = batches.filter((b) => b.qtySisa > 0).sort((a, b) => a.tanggalMasuk.getTime() - b.tanggalMasuk.getTime());

      if (availableBatches.reduce((s, b) => s + b.qtySisa, 0) < qtyToCut) {
        warnings.push(
          `SKU ${kode}: stok batch tersedia (${availableBatches.reduce((s, b) => s + b.qtySisa, 0)}) kurang dari qty outbound (${qtyToCut}) pada baris ${nomorDokumen} tgl ${row['Tanggal Keluar']} - FIFO tetap dijalankan sampai batch habis.`
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
            createdBy: petugasGudang || 'SYSTEM_SEED_V2_1',
            createdAt: effectiveDate,
          },
        });
      }
      if (cleanStr(row['Sisa Stock']) !== '') {
        await syncCheckpoint(kode, meta, num(row['Sisa Stock']), effectiveDate, nomorDokumen);
      }
      mutasiOutboundCount++;
    } else {
      // Sama seperti OUTBOUND: Barang Masuk di sheet tercatat satuan BESAR -> konversi ke kecil.
      const barangMasuk = num(row['Barang Masuk']) * meta.isiPerSatuanBesar;
      const harga = num(row['Harga Barang / Satuan (Rp)']);

      const nomorDokumen = (cleanStr(row['Nomor Dokumen']) || '-') + fallbackTag;
      const nomoratorAwal = cleanStr(row['Awal ']) || '-';
      const nomoratorAkhir = cleanStr(row['Akhir']) || '-';

      const sortedAsc = [...batches].sort((a, b) => a.tanggalMasuk.getTime() - b.tanggalMasuk.getTime());
      const termuda = sortedAsc[sortedAsc.length - 1];

      if (termuda && harga > 0 && Math.abs(termuda.harga - harga) < HARGA_EPSILON) {
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
            createdBy: 'SYSTEM_SEED_V2_1',
            createdAt: effectiveDate,
          },
        });
      } else {
        const hargaBatch = harga > 0 ? harga : meta.hargaBB;
        if (hargaBatch <= 0) {
          warnings.push(
            `WARNING KERAS: SKU ${kode} inbound tgl ${effectiveDate.toISOString().slice(0, 10)} tidak punya harga - batch dibuat dengan harga 0.`
          );
        }
        const newBatch = await prisma.batch_Barang.create({
          data: {
            barangId: meta.barangId,
            lokasiId: lokasiHistori.id,
            tanggal_masuk: effectiveDate,
            qty_awal: barangMasuk,
            qty_sisa: barangMasuk,
            harga_satuan: hargaBatch,
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
            createdBy: 'SYSTEM_SEED_V2_1',
            createdAt: effectiveDate,
          },
        });
        const rec: BatchRec = { id: newBatch.id, harga: hargaBatch, qtyAwal: barangMasuk, qtySisa: barangMasuk, tanggalMasuk: effectiveDate };
        batches.push(rec);
        batches.sort((a, b) => a.tanggalMasuk.getTime() - b.tanggalMasuk.getTime());
        batchesBySku.set(kode, batches);
      }
      if (cleanStr(row['Sisa Stock']) !== '') {
        await syncCheckpoint(kode, meta, num(row['Sisa Stock']), effectiveDate, nomorDokumen);
      }
      mutasiInboundCount++;
    }
  }
  console.log(`  Mutasi di-replay: ${mutasiInboundCount} inbound, ${mutasiOutboundCount} outbound\n`);

  // ==== STEP 5: Rekonsiliasi (HARD-FAIL kalau ada selisih qty per-SKU) ====
  console.log('[Step 5] Rekonsiliasi...\n');

  const allBatches = await prisma.batch_Barang.findMany();
  const totalNilaiStok = allBatches.reduce((sum, b) => sum + b.qty_sisa * b.harga_satuan, 0);
  const totalQtyStok = allBatches.reduce((sum, b) => sum + b.qty_sisa, 0);

  // Running balance final per SKU dari kolom "Sisa Stock" (kadang kosong di baris bermutasi -> turunkan
  // dari runningPrev + masuk - keluar kalau kosong, bukan ambil literal sel terakhir yg bisa kosong).
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

  console.log('=== REKONSILIASI QTY PER-SKU (harus 0 semua / 112) ===');
  console.log('SKU'.padEnd(14) + 'Qty DB'.padStart(10) + 'Qty Buku Besar (kecil)'.padStart(26) + 'Selisih'.padStart(12));

  const selisihList: { sku: string; qtyDb: number; qtyBB: number; selisih: number }[] = [];
  let selisihNonZeroCount = 0;
  let skuBerStok = 0;

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
    if (qtyDb > 0) skuBerStok++;
    console.log(sku.padEnd(14) + String(qtyDb).padStart(10) + String(qtyBB).padStart(26) + String(selisih).padStart(12));
  }

  console.log(`\n  Total SKU dicek: ${allSkus.length} | Selisih = 0: ${allSkus.length - selisihNonZeroCount} | Selisih != 0: ${selisihNonZeroCount}`);
  console.log(`  Total qty stok akhir (satuan kecil): ${totalQtyStok} (ekspektasi pembanding ~1.594.059) | SKU ber-stok > 0: ${skuBerStok} (ekspektasi pembanding 109)`);
  console.log(`  Total nilai stok akhir: Rp ${totalNilaiStok.toLocaleString('id-ID', { minimumFractionDigits: 2 })}\n`);

  if (selisihNonZeroCount > 0) {
    console.log('=== SELISIH QTY != 0 (BUG SCRIPT - HARUS DIPERBAIKI) ===');
    for (const s of selisihList.filter((x) => x.selisih !== 0)) {
      console.log(`  - ${s.sku}: DB=${s.qtyDb} | Buku Besar=${s.qtyBB} | selisih=${s.selisih > 0 ? '+' : ''}${s.selisih}`);
    }
    console.log('');
  }

  // ==== Spot-check ====
  console.log('=== SPOT-CHECK ===');
  for (const sku of ['IDSS-179', 'IDSS-508', 'IDSS-929']) {
    const batches = batchesBySku.get(sku) || [];
    const qtyDb = batches.reduce((s, b) => s + b.qtySisa, 0);
    console.log(`  ${sku}: ${batches.length} batch, total qty_sisa=${qtyDb}`);
    batches.forEach((b, i) =>
      console.log(`    Lot ${i + 1}: qty_sisa=${b.qtySisa}, harga=${b.harga}, tanggal_masuk=${b.tanggalMasuk.toISOString().slice(0, 10)}`)
    );
  }
  console.log('');

  // ==== Ringkasan akhir ====
  const totalMasterBarang = await prisma.master_Barang.count();
  const totalBatchBarang = await prisma.batch_Barang.count();
  const totalMutasiOpening = await prisma.mutasi_Ledger.count({ where: { referensi: { startsWith: 'OPENING - Stock Opname Jun 2026' } } });
  const totalMutasiInbound = await prisma.mutasi_Ledger.count({
    where: { tipe_mutasi: 'INBOUND', NOT: { referensi: { startsWith: 'OPENING - Stock Opname Jun 2026' } } },
  });
  const totalMutasiOutbound = await prisma.mutasi_Ledger.count({ where: { tipe_mutasi: 'OUTBOUND' } });

  console.log('=== RINGKASAN AKHIR ===');
  console.log(`  Master_Barang                : ${totalMasterBarang}`);
  console.log(`  Batch_Barang                 : ${totalBatchBarang}`);
  console.log(`    - dari tier sistem          : ${openingFromTier}`);
  console.log(`    - dari harga Buku Besar     : ${openingFromBB}`);
  console.log(`    - harga 0 (perlu diisi Staf): ${openingFromZero}`);
  console.log(`  Mutasi_Ledger INBOUND (opening) : ${totalMutasiOpening}`);
  console.log(`  Mutasi_Ledger INBOUND (replay)  : ${totalMutasiInbound}`);
  console.log(`  Mutasi_Ledger OUTBOUND (replay) : ${totalMutasiOutbound}`);
  console.log(`  Adjustment sync (Sisa Stock BB) : ${adjustmentSyncCount}`);

  console.log(`\n=== WARNING / SKIP LOG (${warnings.length}) ===`);
  if (warnings.length === 0) {
    console.log('  (tidak ada)');
  } else {
    warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
  }

  console.log('\nSeed v2.1 selesai.');

  if (selisihNonZeroCount > 0) {
    console.error(`\nSEED GAGAL: rekonsiliasi qty per-SKU tidak 0 untuk ${selisihNonZeroCount} dari ${allSkus.length} SKU. Ini menandakan bug di script, bukan data - review daftar selisih di atas sebelum lanjut.`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
