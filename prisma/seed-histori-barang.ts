import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import 'dotenv/config';
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

// Setup WebSocket untuk Neon di environment Node.js
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const pool = new Pool({ connectionString: connectionString! });
const adapter = new PrismaNeon(pool);

const prisma = new PrismaClient({ adapter });

// ==== HELPER: Parse angka format Indonesia ("23.000,00" -> 23000, "-" -> 0) ====
function parseIDNumber(raw: string | undefined | null): number {
  if (!raw) return 0;
  const s = raw.toString().trim();
  if (s === '' || s === '-') return 0;
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ==== HELPER: Ambil angka di depan string, contoh "1 Pcs" -> 1 ====
function parseLeadingInt(raw: string | undefined | null): number {
  if (!raw) return 0;
  const match = raw.toString().trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ==== HELPER: Parse tanggal DD/MM/YYYY ====
function parseIDDate(raw: string | undefined | null): Date | undefined {
  if (!raw) return undefined;
  const s = raw.toString().trim();
  if (!s) return undefined;
  const parts = s.split('/').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some((p) => isNaN(p))) return undefined;
  const [d, m, y] = parts;
  return new Date(Date.UTC(y, m - 1, d));
}

function cleanStr(raw: string | undefined | null): string {
  return raw ? raw.toString().trim() : '';
}

async function main() {
  console.log('🚀 Memulai migrasi Histori Barang (Master + Batch + Ledger)...');

  // 1. Lokasi transit khusus buat data histori
  const lokasiHistori = await prisma.lokasi_Rak.upsert({
    where: { qr_code: 'WMS-TRANSIT-HISTORI-01' },
    update: {},
    create: {
      gudang: 'TRANSIT',
      lorong: 'HISTORI',
      rak: '01',
      qr_code: 'WMS-TRANSIT-HISTORI-01',
    },
  });

  const results: any[] = [];
  const csvFilePath = path.join(process.cwd(), 'Database_Barang.csv');

  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ File ${csvFilePath} tidak ditemukan! Taruh file CSV di root project dengan nama "Database_Barang.csv".`);
    return;
  }

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        separator: ';',
        mapHeaders: ({ header }) => header.trim(),
      })
    )
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      let counter = 0;
      let barangBaruCount = 0;
      let mutasiCount = 0;
      let skipCount = 0;

      // Map buat nge-track batch yang udah dibuat per SKU dalam sesi import ini.
      // Satu SKU bisa punya LEBIH DARI 1 batch (lot) kalau harganya beda (mis. PO beda harga).
      const batchMap = new Map<
        string,
        { barangId: string; masterNama: string; batches: { batchId: string; harga: number; qtySisa: number }[] }
      >();
      const HARGA_EPSILON = 0.5; // toleransi pembulatan rupiah biar "3478.50" dianggap sama dgn "3478.499999"

      for (const row of results) {
        counter++;

        const kode = cleanStr(row['Kode Barang']);
        const nama = cleanStr(row['Nama Barang']);

        if (!kode || !nama) {
          skipCount++;
          continue;
        }

        const satuanBesar = cleanStr(row['Unit Stock Opname']) || cleanStr(row['Satuan']) || 'Pcs';
        const satuanKecil = cleanStr(row['Satuan']) || 'Pcs';
        const isiPerBesar = parseLeadingInt(row['Jumlah / Unit']) || 1;
        const minOrderBesar = parseLeadingInt(row['Minimum Order / Unit']);
        const hargaSatuanKecil = parseIDNumber(row['Harga Barang / Satuan (Rp)']);

        const stockAwal = parseIDNumber(row['Stock Awal']);
        const barangMasuk = parseIDNumber(row['Barang Masuk']);
        const barangKeluar = parseIDNumber(row['Barang Keluar']);
        const sisaStock = parseIDNumber(row['Sisa Stock']);

        const tanggalMasuk = parseIDDate(row['Tanggal Masuk']);
        const tanggalKeluar = parseIDDate(row['Tanggal Keluar']);

        const nomorDokumen = cleanStr(row['Nomor Dokumen']);
        const namaCabang = cleanStr(row['Nama Cabang/Unit Kerja']);
        const picCabang = cleanStr(row['PIC Cabang/Unit Kerja']);
        const petugasGudang = cleanStr(row['Petugas Gudang']);
        const noFpkb = cleanStr(row['No FPKB']);
        const noBast = cleanStr(row['No BAST']);
        const nomoratorAwal = cleanStr(row['Nomorator Awal']);
        const nomoratorAkhir = cleanStr(row['Nomorator Akhir']);
        const keterangan = cleanStr(row['Keterangan']);
        const status = cleanStr(row['Status']);

        const referensi = nomorDokumen || noFpkb || noBast || '-';

        try {
          let entry = batchMap.get(kode);

          if (!entry) {
            // === BARIS PERTAMA UNTUK SKU INI -> Bikin Master Barang + Batch (Saldo Awal) ===
            const barang = await prisma.master_Barang.upsert({
              where: { sku: kode },
              update: {
                satuan_besar: satuanBesar,
                isi_per_satuan_besar: isiPerBesar,
                minimum_order_besar: minOrderBesar || null,
              },
              create: {
                sku: kode,
                nama,
                kategori: 'Migrasi Histori',
                satuan: satuanKecil,
                satuan_besar: satuanBesar,
                isi_per_satuan_besar: isiPerBesar,
                minimum_order_besar: minOrderBesar || null,
                batas_minimum: minOrderBesar * isiPerBesar || 0,
              },
            });

            const qtyAwal = stockAwal > 0 ? stockAwal : sisaStock;

            const batch = await prisma.batch_Barang.create({
              data: {
                barangId: barang.id,
                lokasiId: lokasiHistori.id,
                harga_satuan: hargaSatuanKecil,
                qty_awal: qtyAwal,
                qty_sisa: qtyAwal,
                supplier: '-',
                nomorator_awal: nomoratorAwal || '-',
                nomorator_akhir: nomoratorAkhir || '-',
                status: 'AVAILABLE',
                tanggal_masuk: tanggalMasuk,
              },
            });

            await prisma.mutasi_Ledger.create({
              data: {
                batchId: batch.id,
                tipe_mutasi: 'INBOUND',
                qty_perubahan: qtyAwal,
                saldo_akhir: sisaStock || qtyAwal,
                referensi: 'Saldo Awal Migrasi Histori',
                keterangan: [status, keterangan].filter(Boolean).join(' - ') || 'Saldo awal dari data histori gudang',
                createdBy: 'SYSTEM_MIGRASI',
                createdAt: tanggalMasuk,
              },
            });

            batchMap.set(kode, {
              barangId: barang.id,
              masterNama: nama,
              batches: [{ batchId: batch.id, harga: hargaSatuanKecil, qtySisa: qtyAwal }],
            });
            barangBaruCount++;
            console.log(`✅ [BARU] ${kode} - ${nama} | Saldo awal: ${qtyAwal} ${satuanKecil}`);
            continue;
          }

          // === BARIS LANJUTAN, TAPI TANPA MASUK/KELUAR -> ini "opening" tambahan, bukan mutasi bertanggal ===
          // Contoh nyata: IDSS-508 (3 baris, harga sama, cuma nama beda-beda krn catatan PO lama)
          if (barangMasuk === 0 && barangKeluar === 0) {
            const existingBatch = entry.batches.find((b) => Math.abs(b.harga - hargaSatuanKecil) < HARGA_EPSILON);
            const namaBeda = nama.toLowerCase().trim() !== entry.masterNama.toLowerCase().trim();

            if (existingBatch) {
              // Harga SAMA dgn batch yg sudah ada -> GABUNG qty-nya, jangan didrop & jangan dianggap lot baru
              existingBatch.qtySisa += sisaStock;
              await prisma.batch_Barang.update({
                where: { id: existingBatch.batchId },
                data: { qty_awal: { increment: sisaStock }, qty_sisa: { increment: sisaStock } },
              });
              await prisma.mutasi_Ledger.create({
                data: {
                  batchId: existingBatch.batchId,
                  tipe_mutasi: 'INBOUND',
                  qty_perubahan: sisaStock,
                  saldo_akhir: existingBatch.qtySisa,
                  referensi: 'Saldo Tambahan Migrasi Histori',
                  keterangan: namaBeda
                    ? `PERLU DICEK MANUAL - digabung otomatis (harga sama) tapi nama di CSV beda: "${nama}"`
                    : 'Tambahan qty dari baris opening berulang (harga sama dgn batch existing)',
                  createdBy: 'SYSTEM_MIGRASI',
                  createdAt: tanggalMasuk,
                },
              });
              if (namaBeda) {
                console.warn(`⚠️  [PERLU DICEK] ${kode}: +${sisaStock} digabung ke batch existing, TAPI nama beda -> "${nama}" (master: "${entry.masterNama}")`);
              } else {
                console.log(`➕ [GABUNG] ${kode}: +${sisaStock} ke batch existing (harga sama, total sekarang ${existingBatch.qtySisa})`);
              }
            } else {
              // Harga BEDA dari semua batch yg ada -> lot/PO baru, SKU tetap sama, batch terpisah
              const lotIndex = entry.batches.length;
              const tanggalLot = tanggalMasuk ? new Date(tanggalMasuk.getTime() + lotIndex * 1000) : tanggalMasuk;
              const newBatch = await prisma.batch_Barang.create({
                data: {
                  barangId: entry.barangId,
                  lokasiId: lokasiHistori.id,
                  harga_satuan: hargaSatuanKecil,
                  qty_awal: sisaStock,
                  qty_sisa: sisaStock,
                  supplier: '-',
                  nomorator_awal: nomoratorAwal || '-',
                  nomorator_akhir: nomoratorAkhir || '-',
                  status: 'AVAILABLE',
                  tanggal_masuk: tanggalLot,
                },
              });
              await prisma.mutasi_Ledger.create({
                data: {
                  batchId: newBatch.id,
                  tipe_mutasi: 'INBOUND',
                  qty_perubahan: sisaStock,
                  saldo_akhir: sisaStock,
                  referensi: 'Saldo Awal Migrasi Histori (Lot/PO Harga Berbeda)',
                  keterangan: `Lot terpisah - harga Rp${hargaSatuanKecil} beda dari batch lain di SKU ini`,
                  createdBy: 'SYSTEM_MIGRASI',
                  createdAt: tanggalMasuk,
                },
              });
              entry.batches.push({ batchId: newBatch.id, harga: hargaSatuanKecil, qtySisa: sisaStock });
              console.log(`✅ [LOT BARU] ${kode}: batch baru harga Rp${hargaSatuanKecil}, qty=${sisaStock} (FIFO akan konsumsi lot lama dulu)`);
            }
            mutasiCount++;
            continue;
          }

          // === MUTASI BERTANGGAL BIASA (Barang Masuk / Keluar terisi) -> terapkan ke batch UTAMA (paling lama) ===
          const primary = entry.batches[0];

          if (barangMasuk > 0) {
            primary.qtySisa = sisaStock;
            await prisma.mutasi_Ledger.create({
              data: {
                batchId: primary.batchId,
                tipe_mutasi: 'INBOUND',
                qty_perubahan: barangMasuk,
                saldo_akhir: sisaStock,
                referensi,
                keterangan: [status, keterangan].filter(Boolean).join(' - ') || 'Barang masuk (histori)',
                createdBy: petugasGudang || 'SYSTEM_MIGRASI',
                createdAt: tanggalMasuk,
              },
            });
            await prisma.batch_Barang.update({
              where: { id: primary.batchId },
              data: { qty_sisa: sisaStock },
            });
            mutasiCount++;
          }

          if (barangKeluar > 0) {
            primary.qtySisa = sisaStock;
            const tujuan = [namaCabang, picCabang ? `PIC: ${picCabang}` : ''].filter(Boolean).join(' - ');
            await prisma.mutasi_Ledger.create({
              data: {
                batchId: primary.batchId,
                tipe_mutasi: 'OUTBOUND',
                qty_perubahan: -barangKeluar,
                saldo_akhir: sisaStock,
                referensi,
                keterangan: [tujuan, status, keterangan].filter(Boolean).join(' | ') || 'Barang keluar (histori)',
                createdBy: petugasGudang || 'SYSTEM_MIGRASI',
                createdAt: tanggalKeluar,
              },
            });
            await prisma.batch_Barang.update({
              where: { id: primary.batchId },
              data: { qty_sisa: sisaStock },
            });
            mutasiCount++;
          }

          console.log(`↳ [MUTASI] ${kode} | Masuk: ${barangMasuk || 0} | Keluar: ${barangKeluar || 0} | Sisa: ${sisaStock}`);
        } catch (err) {
          console.error(`⚠️ Gagal proses baris ${counter} (${kode}):`, err);
        }
      }

      console.log('\n🎉 Migrasi selesai!');
      console.log(`   Total baris diproses : ${counter}`);
      console.log(`   Barang baru (Master) : ${barangBaruCount}`);
      console.log(`   Mutasi tercatat      : ${mutasiCount}`);
      console.log(`   Baris di-skip        : ${skipCount}`);
      await prisma.$disconnect();
    });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
