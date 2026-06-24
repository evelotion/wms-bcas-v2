import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config'; 
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Prisma v7 wajib pakai adapter
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Memulai proses seeding data BAST...');

  // 1. Buat/Cari Lokasi Rak Default untuk Barang BAST
  const lokasiTransit = await prisma.lokasi_Rak.upsert({
    where: { qr_code: 'WMS-TRANSIT-BAST-01' },
    update: {},
    create: {
      gudang: 'TRANSIT',
      lorong: 'BAST',
      rak: '01',
      qr_code: 'WMS-TRANSIT-BAST-01',
    },
  });

  const results: any[] = [];
  const csvFilePath = path.join(process.cwd(), 'bast.csv');

  if (!fs.existsSync(csvFilePath)) {
    console.error('❌ File bast.csv tidak ditemukan di root folder!');
    return;
  }

  // 2. Baca file CSV
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      let counter = 1;

      for (const row of results) {
        const kodeBarang = row['Kode Barang']?.trim();
        const namaBarang = row['Nama Barang']?.trim();
        const qtyString = row['Jumlah Barang']?.trim() || '0';
        const satuan = row['Satuan']?.trim() || 'Pcs';
        const kategori = 'Cetakan'; 
        
        const qty = parseInt(qtyString.toString().replace(/[^0-9]/g, ''), 10);
        
        if (!namaBarang || isNaN(qty) || qty === 0) continue;

        const finalSku = kodeBarang ? kodeBarang : `BAST-${counter.toString().padStart(4, '0')}`;

        // 3. Upsert Master Barang
        const barang = await prisma.master_Barang.upsert({
          where: { sku: finalSku },
          update: {},
          create: {
            sku: finalSku,
            nama: namaBarang,
            kategori: kategori,
            satuan: satuan,
            batas_minimum: 50,
          },
        });

        // 4. Buat Batch Barang
        const batch = await prisma.batch_Barang.create({
          data: {
            barangId: barang.id,
            lokasiId: lokasiTransit.id,
            harga_satuan: 0, 
            qty_awal: qty,
            qty_sisa: qty,
            status: 'AVAILABLE',
          },
        });

        // 5. Catat di Mutasi Ledger
        await prisma.mutasi_Ledger.create({
          data: {
            batchId: batch.id,
            tipe_mutasi: 'INBOUND',
            qty_perubahan: qty,
            saldo_akhir: qty,
            referensi: 'BAST Serah Terima Tim Lama',
            keterangan: 'Migrasi Saldo Awal GudangSync V2',
            createdBy: 'SYSTEM_SEED',
          },
        });

        console.log(`✅ Berhasil import: [${finalSku}] ${namaBarang} (Qty: ${qty} ${satuan})`);
        counter++;
      }

      console.log('🎉 Seeding BAST selesai semua, bro!');
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