import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config'; 
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Memulai proses seeding Saldo Awal Gudang...');

  // 1. Setup Lokasi Transit untuk Saldo Awal
  const lokasiAwal = await prisma.lokasi_Rak.upsert({
    where: { qr_code: 'WMS-TRANSIT-AWAL-01' },
    update: {},
    create: {
      gudang: 'TRANSIT',
      lorong: 'AWAL',
      rak: '01',
      qr_code: 'WMS-TRANSIT-AWAL-01',
    },
  });

  const results: any[] = [];
  // Pastikan nama file ini udah sesuai sama yang lo save terakhir
  const csvFilePath = path.join(process.cwd(), 'Stock Awal Gudang.xlsx - Sheet1.csv');

  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ File ${csvFilePath} tidak ditemukan!`);
    return;
  }

  // 2. Baca file CSV dengan settingan Khas Indonesia
  fs.createReadStream(csvFilePath)
    .pipe(csv({ 
      separator: ';', // <--- KUNCI 1: Pakai titik koma
      mapHeaders: ({ header }) => header.trim() // <--- KUNCI 2: Bersihin spasi nyasar di nama kolom
    }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      let counter = 0;
      let successCount = 0;

      for (const row of results) {
        counter++;
        
        const kodeBarang = row['Kode Barang'];
        const namaBarang = row['Nama Barang'];
        const jumlahUnit = parseInt(row['Jumlah Unit'] || '0', 10);
        const jumlahPerUnit = parseInt(row['Jumlah / Unit'] || '1', 10);
        const satuan = row['Satuan'] || 'Pcs';
        
        // KUNCI 3: Handle harga dengan koma desimal (misal: "482,85" diubah jadi "482.85")
        const hargaRaw = row['Harga Barang / Satuan (Rp)'] || '0';
        const hargaSatuanRaw = parseFloat(hargaRaw.toString().replace(',', '.'));
        
        const finalHarga = isNaN(hargaSatuanRaw) ? 0 : hargaSatuanRaw;
        const totalQty = jumlahUnit * (isNaN(jumlahPerUnit) ? 1 : jumlahPerUnit);
        
        // Skip jika tidak ada nama barang atau qty 0
        if (!namaBarang || isNaN(totalQty) || totalQty <= 0) {
            console.log(`⚠️ Baris ${counter} di-skip! (Nama kosong / Qty 0)`);
            continue;
        }

        const finalSku = kodeBarang ? kodeBarang.trim() : `MIGRASI-${counter.toString().padStart(4, '0')}`;

        try {
          // 3. Upsert Master Barang
          const barang = await prisma.master_Barang.upsert({
            where: { sku: finalSku },
            update: {},
            create: {
              sku: finalSku,
              nama: namaBarang.trim(),
              kategori: 'Migrasi Saldo Awal',
              satuan: satuan.trim(),
              batas_minimum: 50,
            },
          });

          // 4. Buat Batch Barang
          const batch = await prisma.batch_Barang.create({
            data: {
              barangId: barang.id,
              lokasiId: lokasiAwal.id,
              harga_satuan: finalHarga,
              qty_awal: totalQty,
              qty_sisa: totalQty,
              supplier: '-',
              nomorator_awal: '-',
              nomorator_akhir: '-',
              status: 'AVAILABLE',
            },
          });

          // 5. Catat di Mutasi Ledger
          await prisma.mutasi_Ledger.create({
            data: {
              batchId: batch.id,
              tipe_mutasi: 'INBOUND',
              qty_perubahan: totalQty,
              saldo_akhir: totalQty,
              referensi: 'Import File Excel Saldo Awal',
              keterangan: `Data apa adanya dari file Stock Awal`,
              createdBy: 'SYSTEM_MIGRASI',
            },
          });

          console.log(`✅ [${finalSku}] ${namaBarang} - Qty: ${totalQty} ${satuan}`);
          successCount++;
        } catch (err) {
          console.error(`⚠️ Gagal insert baris ${counter}: ${namaBarang}`, err);
        }
      }

      console.log(`🎉 Proses Selesai! Berhasil import ${successCount} dari ${counter} baris data.`);
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