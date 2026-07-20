# Spec Implementasi — Fase 2.5 (Sinkronisasi FPP→FPKB ke Repo)

Dokumen ini pasangan dari `Roadmap_Migrasi_WMS.md`. Isinya kode LENGKAP siap-terap per file. Kerjain berurutan dari atas ke bawah — ada dependency (schema harus jalan duluan sebelum actions, actions sebelum halaman).

**Instruksi buat Claude Code:** baca tiap bagian di bawah. Tiap bagian punya "FILE:" (path persis) dan "AKSI:" (CREATE = file baru, REPLACE = timpa seluruh isi file existing, MODIFY = ubah sebagian sesuai instruksi tertulis). Setelah semua diterapkan, jalankan `npx prisma validate` sebelum lanjut ke `db push`.

---

## 1. FILE: `prisma/schema.prisma`
## AKSI: REPLACE seluruh isi file

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // Prisma akan otomatis pakai ini saat db push
}

// --- MASTER DATA ---
model Master_Barang {
  id            String   @id @default(uuid())
  sku           String   @unique
  nama          String
  kategori      String
  satuan        String // Satuan terkecil/atomic, contoh: Lembar, Pcs, Set
  satuan_besar  String? // Satuan kemasan/besar, contoh: Box, Pack, Rim
  isi_per_satuan_besar Int @default(1) // Konversi: 1 satuan_besar = berapa satuan (kecil)
  minimum_order_besar  Int? // Minimum qty order, dalam satuan_besar
  batas_minimum Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  batches           Batch_Barang[]
  permintaanDetails Permintaan_Detail[]
  outstandings      Permintaan_Outstanding[] // Relasi untuk histori barang ngutang
  fpkbItems         Fpkb_Item[]
}

model Lokasi_Rak {
  id      String @id @default(uuid())
  gudang  String
  lorong  String
  rak     String
  qr_code String @unique

  batches Batch_Barang[]
}

model Batch_Barang {
  id            String   @id @default(cuid())
  barangId      String
  lokasiId      String
  tanggal_masuk DateTime @default(now())
  qty_awal      Int
  qty_sisa      Int
  harga_satuan  Float

  // Data spesifik per batch penerimaan
  supplier        String?
  nomorator_awal  String?
  nomorator_akhir String?

  status    StatusBatch @default(AVAILABLE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  barang Master_Barang   @relation(fields: [barangId], references: [id])
  lokasi Lokasi_Rak      @relation(fields: [lokasiId], references: [id])
  mutasi Mutasi_Ledger[]
  item_seri Item_Seri[]
}

model Item_Seri {
  id         String       @id @default(uuid())
  batchId    String
  batch      Batch_Barang @relation(fields: [batchId], references: [id])
  nomor_seri String 
  is_used    Boolean      @default(false)
}

model Mutasi_Ledger {
  id      String       @id @default(uuid())
  batchId String
  batch   Batch_Barang @relation(fields: [batchId], references: [id])

  tipe_mutasi   TipeMutasi
  qty_perubahan Int // Positif untuk INBOUND/RETUR, negatif untuk OUTBOUND
  saldo_akhir   Int // Snapshot sisa qty di batch ini SETELAH mutasi terjadi
  referensi     String? // Nomor PO, Bukti FPKB, atau ID Requisition
  keterangan    String?
  createdAt DateTime @default(now())
  createdBy String // ID User/Petugas
}

enum StatusBatch {
  QUARANTINE
  AVAILABLE
  DEPLETED
}

enum TipeMutasi {
  INBOUND
  OUTBOUND
  RETUR
}

// === ENUM BARU UNTUK FLOW ADMIN & GUDANG ===
enum Role {
  ADMIN
  GUDANG
}

enum StatusFpp {
  OPEN   // Masih ada item yang outstanding & belum diputuskan final
  CLOSED // Semua item fulfilled, ATAU sisanya sudah di-reject Staf
}

enum StatusFpkb {
  MENUNGGU_ADJUSTMENT   // Baru digenerate Staf, nunggu Admin Gudang cek stok & realisasi
  MENUNGGU_SERAH_TERIMA // Realisasi udah ditentukan & barang dikeluarkan, nunggu dokumen diupload
  SELESAI               // Dokumen serah terima (FPKB signed, +BAST kalau NON_JABODETABEK) lengkap
}

enum WilayahCabang {
  JABODETABEK
  NON_JABODETABEK
}

enum StatusItem {
  FULFILLED     // Dipenuhi 100%
  PARTIAL       // Dipenuhi sebagian, sisanya masuk outstanding
  OUTSTANDING   // 0% dipenuhi (stok kosong)
  CANCELLED     // Dibatalkan permanen (di-reject Staf, nggak dilanjutkan)
}

// Counter buat penomoran sementara (mulai dari 1). Nanti kalau format resmi udah
// fix, tinggal ganti cara format-nya di src/lib/sequence.ts tanpa ubah data lama.
model Sequence_Counter {
  id      String @id // "FPP" | "FPKB" | "BAST"
  current Int    @default(0)
}

// --- MODUL PERMINTAAN (REQUISITION) ---
// 1 FPP = 1 permintaan dari Cabang. Bisa punya BANYAK Fpkb (FPKB awal + FPKB
// susulan tiap kali outstanding-nya diproses ulang setelah restock).
model Permintaan_Header {
  id            String   @id @default(cuid())
  nomor_fpp     String   @unique // Sequential sementara ("1","2",...)
  cabang        String
  wilayah       WilayahCabang @default(JABODETABEK)
  pic_nama      String?  // Dikosongin dulu sampai data resmi ada
  keterangan    String?
  status        StatusFpp @default(OPEN)

  adminId       String? // Staf yang input FPP ini
  admin         User?   @relation("StafInputFpp", fields: [adminId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  details      Permintaan_Detail[]
  fpkbs        Fpkb[]
  outstandings Permintaan_Outstanding[]
}

// Rincian barang yang diminta di FPP (target keseluruhan, lintas semua FPKB)
model Permintaan_Detail {
  id            String  @id @default(cuid())
  headerId      String
  barangId      String
  qty_diminta   Int // Jumlah yang tercantum di FPP asli
  qty_terpenuhi Int      @default(0) // Akumulasi realisasi dari SEMUA Fpkb terkait FPP ini
  status_item   StatusItem @default(OUTSTANDING)
  keterangan    String?

  header Permintaan_Header @relation(fields: [headerId], references: [id], onDelete: Cascade)
  barang Master_Barang     @relation(fields: [barangId], references: [id])
}

// Satu instance FPKB (bisa lebih dari satu per FPP)
model Fpkb {
  id         String     @id @default(cuid())
  nomor_fpkb String     @unique // Sequential sementara
  headerId   String
  header     Permintaan_Header @relation(fields: [headerId], references: [id], onDelete: Cascade)

  status     StatusFpkb @default(MENUNGGU_ADJUSTMENT)

  gudangId   String? // Admin Gudang yang proses adjustment & serah terima
  gudang     User?   @relation("AdminGudangProses", fields: [gudangId], references: [id])

  // Serah terima
  nomor_bast           String?   // Cuma dipakai kalau wilayah NON_JABODETABEK
  nomor_airwaybill     String?   // Cuma dipakai kalau wilayah NON_JABODETABEK
  file_fpkb_signed     String?   @db.Text // base64 file FPKB yang sudah ditandatangani
  file_bast_signed     String?   @db.Text // base64 file BAST yang sudah ditandatangani
  tanggal_serah_terima DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  items Fpkb_Item[]
  outstandingSebagaiPenyebab Permintaan_Outstanding[] @relation("FpkbPenyebab")
  outstandingSebagaiPenutup  Permintaan_Outstanding[] @relation("FpkbPenutup")
}

// Rincian barang PADA satu FPKB spesifik (bisa subset dari Permintaan_Detail,
// misal cuma barang yang outstanding di FPKB sebelumnya)
model Fpkb_Item {
  id            String     @id @default(cuid())
  fpkbId        String
  fpkb          Fpkb @relation(fields: [fpkbId], references: [id], onDelete: Cascade)

  barangId      String
  barang        Master_Barang @relation(fields: [barangId], references: [id])

  qty_diminta   Int // Qty yang coba dipenuhi lewat FPKB ini
  qty_realisasi Int        @default(0) // Qty yang beneran dikeluarkan Admin Gudang
  status_item   StatusItem @default(OUTSTANDING)
  keterangan    String?
}

// --- TABEL OUTSTANDING ---
model Permintaan_Outstanding {
  id       String @id @default(uuid())
  headerId String // FPP asal, biar gampang dilacak
  header   Permintaan_Header @relation(fields: [headerId], references: [id], onDelete: Cascade)

  fpkbAsalId String? // FPKB yang menyebabkan outstanding ini muncul
  fpkbAsal   Fpkb?   @relation("FpkbPenyebab", fields: [fpkbAsalId], references: [id])

  fpkbLanjutanId String? // FPKB baru yang dipakai buat nutupin outstanding ini (kalau udah diproses ulang)
  fpkbLanjutan   Fpkb?   @relation("FpkbPenutup", fields: [fpkbLanjutanId], references: [id])

  barangId String
  barang   Master_Barang @relation(fields: [barangId], references: [id])

  qty_sisa Int
  status   StatusItem @default(OUTSTANDING) // OUTSTANDING | FULFILLED | CANCELLED (di-reject Staf)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// --- MODUL SECURITY & AUTH ---
model User {
  id        String   @id @default(cuid())
  username  String   @unique
  nama      String
  password  String   // Pastikan di-bcrypt pas production
  role      Role     @default(ADMIN) // ADMIN = Staf | GUDANG = Admin Gudang

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relasi balik untuk tracking kerjaan
  fpp_dibuat    Permintaan_Header[] @relation("StafInputFpp")
  fpkb_diproses Fpkb[]              @relation("AdminGudangProses")
}```

---

## 2. FILE: `src/lib/sequence.ts`
## AKSI: CREATE (file baru)

```typescript
import prisma from "@/lib/prisma";

/**
 * Ambil nomor urut berikutnya untuk sebuah entitas ("FPP" | "FPKB" | "BAST"),
 * mulai dari 1. Dijamin nggak bentrok walau ada request barengan (pakai upsert atomik).
 *
 * SEMENTARA formatnya cuma angka polos ("1", "2", "3", ...). Begitu format resmi
 * (mis. "070/FPP/LOG/2026") udah fix, tinggal ubah return statement di bawah -
 * nggak perlu ubah kode yang manggil fungsi ini.
 */
export async function getNextSequenceNumber(kind: "FPP" | "FPKB" | "BAST"): Promise<string> {
  const counter = await prisma.sequence_Counter.upsert({
    where: { id: kind },
    update: { current: { increment: 1 } },
    create: { id: kind, current: 1 },
  });

  return String(counter.current);
}
```

---

## 3. FILE: `src/app/permintaan/actions.ts`
## AKSI: REPLACE seluruh isi file (versi lama pakai nomor FPP manual + approvePermintaan lama, HAPUS total)

```typescript
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getNextSequenceNumber } from "@/lib/sequence";

export async function getPermintaanFormData() {
  const barang = await prisma.master_Barang.findMany({ orderBy: { nama: 'asc' } });
  return { barang };
}

// STAF: Ambil daftar semua FPP (buat dashboard Staf - lihat status keseluruhan tiap FPP)
export async function getDaftarFpp(): Promise<any[]> {
  return await prisma.permintaan_Header.findMany({
    include: {
      details: { include: { barang: true } },
      fpkbs: { include: { items: true } },
      outstandings: { where: { status: 'OUTSTANDING' } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// STAF: Input FPP dari PDF email Cabang. FPP ini LANGSUNG jadi FPKB pertamanya
// (nomor FPP & nomor FPKB sama-sama digenerate di sini, sesuai alur: "FPP pure
// berubah jadi FPKB, yang proses itu Staf").
export async function createFppBaru(
  headerData: { cabang: string; wilayah: 'JABODETABEK' | 'NON_JABODETABEK'; pic_nama?: string; keterangan?: string },
  detailsData: { barangId: string; qty: number }[],
  adminId?: string
) {
  try {
    if (detailsData.length === 0) {
      throw new Error("Minimal 1 barang harus diisi.");
    }

    const nomorFpp = await getNextSequenceNumber("FPP");
    const nomorFpkb = await getNextSequenceNumber("FPKB");

    const header = await prisma.permintaan_Header.create({
      data: {
        nomor_fpp: nomorFpp,
        cabang: headerData.cabang,
        wilayah: headerData.wilayah,
        pic_nama: headerData.pic_nama || null,
        keterangan: headerData.keterangan || null,
        status: 'OPEN',
        adminId: adminId || null,
        details: {
          create: detailsData.map((d) => ({
            barangId: d.barangId,
            qty_diminta: d.qty,
            qty_terpenuhi: 0,
            status_item: 'OUTSTANDING',
          })),
        },
        fpkbs: {
          create: {
            nomor_fpkb: nomorFpkb,
            status: 'MENUNGGU_ADJUSTMENT',
            items: {
              create: detailsData.map((d) => ({
                barangId: d.barangId,
                qty_diminta: d.qty,
                qty_realisasi: 0,
                status_item: 'OUTSTANDING',
              })),
            },
          },
        },
      },
      include: { fpkbs: true },
    });

    revalidatePath("/permintaan");
    revalidatePath("/fpkb");
    return { success: true, nomor_fpp: nomorFpp, nomor_fpkb: nomorFpkb, headerId: header.id };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menyimpan FPP baru." };
  }
}

// STAF: Tutup permanen sisa outstanding (nggak dilanjutkan). Ini keputusan bisnis
// Staf, bukan Admin Gudang.
export async function tutupOutstanding(outstandingIds: string[]) {
  try {
    await prisma.$transaction(async (tx: any) => {
      for (const id of outstandingIds) {
        const os = await tx.permintaan_Outstanding.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });
        // Kalau semua outstanding di FPP ini udah nggak ada yang OUTSTANDING lagi -> CLOSED
        const sisaOutstanding = await tx.permintaan_Outstanding.count({
          where: { headerId: os.headerId, status: 'OUTSTANDING' },
        });
        if (sisaOutstanding === 0) {
          await tx.permintaan_Header.update({
            where: { id: os.headerId },
            data: { status: 'CLOSED' },
          });
        }
      }
    });
    revalidatePath("/permintaan");
    revalidatePath("/outstanding");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menutup outstanding." };
  }
}

// STAF: Terbitkan FPKB baru buat nutupin outstanding yang dipilih (masih terikat FPP asal)
export async function prosesUlangOutstanding(outstandingIds: string[]) {
  try {
    if (outstandingIds.length === 0) throw new Error("Pilih minimal 1 barang outstanding.");

    const outstandingRows = await prisma.permintaan_Outstanding.findMany({
      where: { id: { in: outstandingIds }, status: 'OUTSTANDING' },
    });
    if (outstandingRows.length === 0) throw new Error("Barang outstanding tidak ditemukan / sudah diproses.");

    // Pastikan semua dari FPP yang sama (1 FPKB baru = 1 FPP)
    const headerIds = new Set(outstandingRows.map((o) => o.headerId));
    if (headerIds.size > 1) throw new Error("Outstanding yang dipilih harus dari FPP yang sama.");
    const headerId = outstandingRows[0].headerId;

    const nomorFpkb = await getNextSequenceNumber("FPKB");

    const result = await prisma.$transaction(async (tx: any) => {
      const newFpkb = await tx.fpkb.create({
        data: {
          nomor_fpkb: nomorFpkb,
          headerId,
          status: 'MENUNGGU_ADJUSTMENT',
          items: {
            create: outstandingRows.map((o) => ({
              barangId: o.barangId,
              qty_diminta: o.qty_sisa,
              qty_realisasi: 0,
              status_item: 'OUTSTANDING',
            })),
          },
        },
      });

      for (const o of outstandingRows) {
        await tx.permintaan_Outstanding.update({
          where: { id: o.id },
          data: { fpkbLanjutanId: newFpkb.id },
        });
      }

      return newFpkb;
    });

    revalidatePath("/permintaan");
    revalidatePath("/outstanding");
    revalidatePath("/fpkb");
    return { success: true, nomor_fpkb: result.nomor_fpkb, fpkbId: result.id };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menerbitkan FPKB baru." };
  }
}
```

---

## 4. FILE: `src/app/fpkb/actions.ts`
## AKSI: CREATE (file baru, folder `src/app/fpkb/` juga baru)

```typescript
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getNextSequenceNumber } from "@/lib/sequence";

// ADMIN GUDANG: Antrean FPKB yang belum di-adjustment
export async function getFpkbMenungguAdjustment(): Promise<any[]> {
  return await prisma.fpkb.findMany({
    where: { status: 'MENUNGGU_ADJUSTMENT' },
    include: { header: true, items: { include: { barang: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

// ADMIN GUDANG: FPKB yang udah di-adjustment tapi dokumen serah terima belum lengkap
// -> ini yang jadi basis alert "belum selesai serah terima"
export async function getFpkbMenungguSerahTerima(): Promise<any[]> {
  return await prisma.fpkb.findMany({
    where: { status: 'MENUNGGU_SERAH_TERIMA' },
    include: { header: true, items: { include: { barang: true } } },
    orderBy: { updatedAt: 'asc' },
  });
}

export async function getDetailFpkb(fpkbId: string) {
  return await prisma.fpkb.findUnique({
    where: { id: fpkbId },
    include: { header: true, items: { include: { barang: true } }, gudang: true },
  });
}

// ADMIN GUDANG: Proses adjustment - cek stok, tentuin realisasi per item, potong stok
// FIFO per batch (sama seperti logic lama), sisanya yang nggak kekejar jadi Outstanding.
export async function prosesAdjustmentFpkb(
  fpkbId: string,
  adjustments: { itemId: string; qtyRealisasi: number }[],
  gudangId?: string
): Promise<{ success: boolean; instruksi?: string[]; error?: string }> {
  try {
    let instruksi: string[] = [];

    await prisma.$transaction(async (tx: any) => {
      const fpkb = await tx.fpkb.findUnique({
        where: { id: fpkbId },
        include: { items: { include: { barang: true } }, header: true },
      });
      if (!fpkb) throw new Error("FPKB tidak ditemukan!");
      if (fpkb.status !== 'MENUNGGU_ADJUSTMENT') throw new Error("FPKB ini sudah diproses sebelumnya!");

      let masihAdaOutstanding = false;

      for (const item of fpkb.items) {
        const adj = adjustments.find((a) => a.itemId === item.id);
        const qtyDiminta = adj ? Math.min(adj.qtyRealisasi, item.qty_diminta) : item.qty_diminta;

        let qtyToProcess = qtyDiminta;
        let qtyDapat = 0;

        if (qtyToProcess > 0) {
          const availableBatches = await tx.batch_Barang.findMany({
            where: { barangId: item.barangId, qty_sisa: { gt: 0 }, status: 'AVAILABLE' },
            orderBy: { tanggal_masuk: 'asc' },
            include: { lokasi: true },
          });

          for (const batch of availableBatches) {
            if (qtyToProcess <= 0) break;
            const potong = Math.min(batch.qty_sisa, qtyToProcess);
            qtyToProcess -= potong;
            qtyDapat += potong;

            const sisaDiRak = batch.qty_sisa - potong;
            await tx.batch_Barang.update({
              where: { id: batch.id },
              data: { qty_sisa: sisaDiRak, status: sisaDiRak <= 0 ? 'DEPLETED' : 'AVAILABLE' },
            });

            instruksi.push(`Ambil ${potong} ${item.barang.satuan} [${item.barang.sku}] dari Rak ${batch.lokasi.lorong}-${batch.lokasi.rak}`);

            await tx.mutasi_Ledger.create({
              data: {
                batchId: batch.id,
                tipe_mutasi: 'OUTBOUND',
                qty_perubahan: potong,
                saldo_akhir: sisaDiRak,
                referensi: fpkb.nomor_fpkb,
                keterangan: `FPKB ${fpkb.nomor_fpkb} - ${fpkb.header.cabang}`,
                createdBy: gudangId || 'ADMIN_GUDANG',
              },
            });
          }
        }

        const qtyKurang = item.qty_diminta - qtyDapat;
        const statusItem = qtyKurang <= 0 ? 'FULFILLED' : qtyDapat > 0 ? 'PARTIAL' : 'OUTSTANDING';

        await tx.fpkb_Item.update({
          where: { id: item.id },
          data: { qty_realisasi: qtyDapat, status_item: statusItem },
        });

        // Akumulasi ke Permintaan_Detail (target keseluruhan FPP)
        const detail = await tx.permintaan_Detail.findFirst({
          where: { headerId: fpkb.headerId, barangId: item.barangId },
        });
        if (detail) {
          const totalTerpenuhi = detail.qty_terpenuhi + qtyDapat;
          await tx.permintaan_Detail.update({
            where: { id: detail.id },
            data: {
              qty_terpenuhi: totalTerpenuhi,
              status_item: totalTerpenuhi >= detail.qty_diminta ? 'FULFILLED' : totalTerpenuhi > 0 ? 'PARTIAL' : 'OUTSTANDING',
            },
          });
        }

        if (qtyKurang > 0) {
          masihAdaOutstanding = true;
          await tx.permintaan_Outstanding.create({
            data: {
              headerId: fpkb.headerId,
              fpkbAsalId: fpkb.id,
              barangId: item.barangId,
              qty_sisa: qtyKurang,
              status: 'OUTSTANDING',
            },
          });
        }
      }

      await tx.fpkb.update({
        where: { id: fpkbId },
        data: { status: 'MENUNGGU_SERAH_TERIMA', gudangId: gudangId || null },
      });

      // Kalau nggak ada outstanding baru DAN nggak ada outstanding lama yang masih nunggak -> FPP bisa CLOSED
      if (!masihAdaOutstanding) {
        const sisaOutstandingLain = await tx.permintaan_Outstanding.count({
          where: { headerId: fpkb.headerId, status: 'OUTSTANDING' },
        });
        if (sisaOutstandingLain === 0) {
          await tx.permintaan_Header.update({ where: { id: fpkb.headerId }, data: { status: 'CLOSED' } });
        }
      }
    });

    revalidatePath("/fpkb");
    revalidatePath("/outstanding");
    revalidatePath("/permintaan");
    return { success: true, instruksi };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memproses adjustment FPKB." };
  }
}

// ADMIN GUDANG: Upload dokumen serah terima. JABODETABEK cuma butuh FPKB signed.
// NON_JABODETABEK butuh FPKB signed + BAST signed + nomor airwaybill.
export async function uploadServahTerimaFpkb(
  fpkbId: string,
  data: { fileFpkbBase64: string; fileBastBase64?: string; nomorAirwaybill?: string }
) {
  try {
    const fpkb = await prisma.fpkb.findUnique({ where: { id: fpkbId }, include: { header: true } });
    if (!fpkb) throw new Error("FPKB tidak ditemukan!");
    if (fpkb.status !== 'MENUNGGU_SERAH_TERIMA') throw new Error("FPKB ini belum di-adjustment atau sudah selesai.");

    const isJabodetabek = fpkb.header.wilayah === 'JABODETABEK';

    if (!data.fileFpkbBase64) throw new Error("File FPKB yang sudah ditandatangani wajib diupload.");
    if (!isJabodetabek && !data.fileBastBase64) throw new Error("Wilayah NON_JABODETABEK wajib upload BAST juga.");
    if (!isJabodetabek && !data.nomorAirwaybill) throw new Error("Wilayah NON_JABODETABEK wajib isi nomor Airwaybill/resi.");

    let nomorBast: string | null = null;
    if (!isJabodetabek) {
      nomorBast = await getNextSequenceNumber("BAST");
    }

    await prisma.fpkb.update({
      where: { id: fpkbId },
      data: {
        file_fpkb_signed: data.fileFpkbBase64,
        file_bast_signed: data.fileBastBase64 || null,
        nomor_airwaybill: data.nomorAirwaybill || null,
        nomor_bast: nomorBast,
        tanggal_serah_terima: new Date(),
        status: 'SELESAI',
      },
    });

    revalidatePath("/fpkb");
    return { success: true, nomor_bast: nomorBast };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal upload dokumen serah terima." };
  }
}
```

---

## 5. FILE: `src/app/outstanding/actions.ts`
## AKSI: REPLACE seluruh isi file (versi lama pakai resolveOutstandingItem, HAPUS total)

```typescript
"use server";

import prisma from "@/lib/prisma";

// Dipakai di dashboard STAF dan ADMIN GUDANG - keduanya lihat data yang sama,
// termasuk info FPP asal & FPKB yang menyebabkan outstanding ini muncul.
export async function getOutstandingList() {
  return await prisma.permintaan_Outstanding.findMany({
    where: { status: 'OUTSTANDING' },
    include: {
      barang: true,
      header: true,       // Info FPP asal (nomor_fpp, cabang, wilayah)
      fpkbAsal: true,      // FPKB yang bikin item ini outstanding
      fpkbLanjutan: true,  // Kalau udah diterbitkan FPKB susulan, ini nunjuk ke situ
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Re-export dari permintaan/actions.ts biar 1 sumber logic aja (dipanggil dari sini
// oleh halaman /outstanding, tapi juga dipakai Staf dari halaman /permintaan)
export { tutupOutstanding, prosesUlangOutstanding } from "@/app/permintaan/actions";
```

---

## 6. FILE: `src/app/actions.ts`
## AKSI: MODIFY - tambahkan fungsi `getFpkbAlerts` di akhir file (JANGAN hapus `getDashboardStats` yang sudah ada)

```typescript
// Tambahkan ini di akhir file src/app/actions.ts, setelah fungsi getDashboardStats:

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
}```

---

## 7. FILE: `src/lib/generateFpkb.ts`
## AKSI: REPLACE seluruh isi file (versi lama masih ada nama hardcoded & belum ada kolom Realisasi)

```typescript
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface FPKBItem {
  kode: string;
  nama: string;
  jumlahPack: number | string;
  jumlahSatuan: string;
  hargaSatuan: number;
  total: number;
  realisasiPack?: number | string; // Kosong = belum di-adjustment Admin Gudang
  realisasiSatuan?: string;
  keterangan: string;
}

export interface FPKBData {
  nomorFpkb: string;
  noFpp?: string;
  tglRequest: string;
  cabang: string;
  pic?: string; // Dikosongin dulu kalau data belum valid
  items: FPKBItem[];
  grandTotal: number;
  // Semua nama penandatangan OPSIONAL - dikosongin (garis titik-titik) kalau nggak diisi
  pembuat?: string;
  verifikator?: string;
  penyetuju?: string;
  penyerahLogistik?: string;
}

const formatRupiah = (angka: number) => {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(angka);
};

const namaOrTitik = (nama?: string) => (nama && nama.trim() ? nama : "..........................");

export const generateFPKB = (data: FPKBData) => {
  const doc = new jsPDF("p", "mm", "a4");

  // --- KOP SURAT ---
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BCAsyariah", 14, 20);

  doc.setFontSize(12);
  doc.text("FORM PERSETUJUAN KELUAR BARANG", 105, 20, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`No. ${data.nomorFpkb}`, 105, 25, { align: "center" });

  // --- A. INFORMASI PERMINTAAN ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("A. INFORMASI PERMINTAAN", 14, 35);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text("Media Request", 14, 42);      doc.text(`: FPP`, 45, 42);
  doc.text("No Dokumen (FPP)", 14, 47);   doc.text(`: ${data.noFpp || '-'}`, 45, 47);
  doc.text("Tgl Dokumen", 14, 52);        doc.text(`: ${data.tglRequest}`, 45, 52);
  doc.text("Cabang/Unit Kerja", 14, 57);  doc.text(`: ${data.cabang}`, 45, 57);

  doc.text("Tgl Request", 120, 42);       doc.text(`: ${data.tglRequest}`, 145, 42);
  doc.text("PIC Unit Kerja", 120, 47);    doc.text(`: ${namaOrTitik(data.pic)}`, 145, 47);
  doc.text("Jenis Permintaan", 120, 52);  doc.text(`: Existing`, 145, 52);
  doc.text("Ketersediaan", 120, 57);      doc.text(`: [ V ] Ada     [   ] Tidak Ada`, 145, 57);

  // --- B. DETAIL PERSETUJUAN BARANG (+ kolom Realisasi) ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("B. DETAIL PERSETUJUAN BARANG*", 14, 67);

  const tableBody = data.items.map((item, index) => [
    index + 1,
    item.kode,
    item.nama,
    item.jumlahPack || "-",
    item.jumlahSatuan,
    formatRupiah(item.hargaSatuan),
    formatRupiah(item.total),
    item.realisasiPack ?? "",
    item.realisasiSatuan ?? "",
    item.keterangan || "",
  ]);

  tableBody.push(["", "", "", "", "", "Grand Total", formatRupiah(data.grandTotal), "", "", ""]);

  autoTable(doc, {
    startY: 70,
    head: [["No.", "Kode Barang", "Nama Barang", "Jml Pack", "Jml Satuan", "Harga Satuan", "Total", "Realisasi Pack", "Realisasi Satuan", "Keterangan"]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center', fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 1.5, textColor: 0, lineColor: [150, 150, 150] },
    columnStyles: {
      0: { halign: 'center' },
      3: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'center' },
      8: { halign: 'center' },
    },
    didParseCell: function (cellData) {
      if (cellData.row.index === tableBody.length - 1) {
        cellData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 10;

  if (currentY > 180) {
    doc.addPage();
    currentY = 20;
  }

  // --- C. PENGELUARAN & SERAH TERIMA BARANG ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("C. PENGELUARAN & SERAH TERIMA BARANG", 14, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.rect(14, currentY + 3, 182, 35);

  doc.text("Diserahkan", 20, currentY + 8);
  doc.text("(Logistik/Admin Gudang)", 20, currentY + 12);
  doc.text("Tgl:", 20, currentY + 26);
  doc.text(namaOrTitik(data.penyerahLogistik), 20, currentY + 32);

  doc.text("Diterima", 90, currentY + 8);
  doc.text("(Penerima/Cabang)", 90, currentY + 12);
  doc.text("Tgl:", 90, currentY + 26);
  doc.text("..........................", 90, currentY + 32);

  doc.text("No. BAST : ..............................................", 140, currentY + 8);
  doc.text("No. AWB   : ..............................................", 140, currentY + 16);

  // --- TANDA TANGAN APPROVAL ---
  currentY += 45;

  doc.text("Dibuat", 20, currentY);
  doc.text("(Staf)", 20, currentY + 4);
  doc.text("Tgl:", 20, currentY + 15);
  doc.text(namaOrTitik(data.pembuat), 20, currentY + 25);

  doc.text("Diverifikasi", 80, currentY);
  doc.text("(SPV Logistik)", 80, currentY + 4);
  doc.text("Tgl:", 80, currentY + 15);
  doc.text(namaOrTitik(data.verifikator), 80, currentY + 25);

  doc.text("Disetujui", 140, currentY);
  doc.text("(Ka Bid/Dept Logistik)", 140, currentY + 4);
  doc.text("Tgl:", 140, currentY + 15);
  doc.text(namaOrTitik(data.penyetuju), 140, currentY + 25);

  // --- KETENTUAN ---
  currentY += 32;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Ketentuan:", 14, currentY);

  doc.setFont("helvetica", "normal");
  doc.text("*) Kolom Realisasi diisi Admin Gudang sesuai stok yang benar-benar dikeluarkan.", 14, currentY + 4);
  doc.text("Kolom Realisasi kosong berarti FPKB ini belum melalui proses adjustment.", 14, currentY + 8);

  const safeFilename = data.nomorFpkb.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  doc.save(`FPKB_${safeFilename}.pdf`);
};
```

---

## 8. FILE: `src/lib/generateBast.ts`
## AKSI: CREATE (file baru, khusus dipanggil kalau `wilayah === "NON_JABODETABEK"`)

```typescript
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface BASTItem {
  kode: string;
  nama: string;
  qty: number;
  unit?: string;
  spesifikasi?: string;
  keterangan: string;
}

export interface BASTData {
  nomorBast: string;
  namaPenerima?: string; // Dikosongin dulu kalau data belum valid
  noDokumenFpkb: string;
  tglDokumen: string;
  cabang: string;
  jenisAset?: string; // default "Non Aktiva"
  items: BASTItem[];
  namaMenyerahkan?: string; // Admin Gudang
  jabatanMenyerahkan?: string;
}

const namaOrTitik = (nama?: string) => (nama && nama.trim() ? nama : "..........................");

// Dibuat otomatis dari data Realisasi di FPKB yang sama - dipanggil setelah
// Admin Gudang selesai adjustment, khusus buat cabang NON_JABODETABEK.
export const generateBAST = (data: BASTData) => {
  const doc = new jsPDF("p", "mm", "a4");

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BCAsyariah", 14, 20);

  doc.setFontSize(14);
  doc.text("BERITA ACARA SERAH TERIMA BARANG", 105, 30, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.text(`No. ${data.nomorBast}`, 105, 36, { align: "center" });
  doc.setFont("helvetica", "normal");

  // --- A. INFORMASI PENERIMA ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("A. INFORMASI PENERIMA", 14, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Nama", 14, 55);                 doc.text(`: ${namaOrTitik(data.namaPenerima)}`, 55, 55);
  doc.text("No Dokumen & Tanggal", 14, 61);  doc.text(`: ${data.noDokumenFpkb}`, 55, 61);
  doc.text("Perihal", 14, 67);               doc.text(`: Barang Cetakan`, 55, 67);

  doc.text("Tgl Dokumen Diterima", 120, 55); doc.text(`: ${data.tglDokumen}`, 165, 55);
  doc.text("Cabang/Unit Kerja", 120, 61);    doc.text(`: ${data.cabang}`, 165, 61);
  doc.text("Jenis Aset", 120, 67);           doc.text(`: ${data.jenisAset || "Non Aktiva"}`, 165, 67);

  // --- B. DETAIL BARANG ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("B. DETAIL BARANG YANG DISERAHKAN", 14, 77);

  const tableBody = data.items.map((item, index) => [
    index + 1,
    item.kode,
    item.nama,
    item.qty,
    item.unit || "",
    item.spesifikasi || "",
    item.keterangan || "",
  ]);

  autoTable(doc, {
    startY: 80,
    head: [["No", "Kode Barang", "Nama Barang", "Qty", "Unit", "Spesifikasi", "Keterangan"]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 8, cellPadding: 2, textColor: 0, lineColor: [150, 150, 150] },
    columnStyles: { 0: { halign: 'center' }, 3: { halign: 'center' } },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 12;

  // --- C. PERNYATAAN PENERIMA ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("C. PERNYATAAN PENERIMA", 14, currentY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Saya bertanggung jawab atas barang yang diterima, dan memastikan barang sudah dicheck dan diterima dalam keadaan baik.", 14, currentY + 6);

  // --- D. SERAH TERIMA BARANG ---
  currentY += 20;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("D. SERAH TERIMA BARANG", 14, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Tanggal :", 20, currentY + 8);
  doc.text("Tanggal :", 115, currentY + 8);

  doc.rect(14, currentY + 12, 85, 40);
  doc.rect(110, currentY + 12, 85, 40);

  doc.setFont("helvetica", "bold");
  doc.text("Menyerahkan", 45, currentY + 18, { align: "center" });
  doc.text("Menerima", 152, currentY + 18, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.text(namaOrTitik(data.namaMenyerahkan), 45, currentY + 40, { align: "center" });
  doc.text(data.jabatanMenyerahkan || "Staff Gudang", 45, currentY + 45, { align: "center" });

  doc.text("..........................", 152, currentY + 40, { align: "center" });

  const safeFilename = data.nomorBast.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  doc.save(`BAST_${safeFilename}.pdf`);
};
```

---

## 9. Yang BELUM tercakup di spec ini (masih perlu dikerjain manual/dengan bantuan Claude Code langsung, bukan copy-paste)

- `src/app/permintaan/page.tsx` - rewrite total: hapus input manual nomor FPP, sesuaikan pemanggilan ke `createFppBaru` & `getDaftarFpp` versi baru, hapus panggilan `approvePermintaan` (udah pindah ke `fpkb/actions.ts` sebagai `prosesAdjustmentFpkb`)
- `src/app/outstanding/page.tsx` - rewrite: ganti UI "fulfill langsung" jadi tombol "Tutup" (panggil `tutupOutstanding`) & "Proses Ulang" (panggil `prosesUlangOutstanding`)
- `src/app/fpkb/page.tsx` - halaman BARU, belum ada sama sekali. Ini dashboard Admin Gudang: list dari `getFpkbMenungguAdjustment()`, form adjustment per item manggil `prosesAdjustmentFpkb()`, lalu setelah sukses tampilkan tombol cetak (`generateFPKB`) dan form upload serah terima manggil `uploadServahTerimaFpkb()`
- `src/app/page.tsx` (dashboard) - tambah section alert dari `getFpkbAlerts()`
- Update label role di UI (cari semua tempat yang nampilin `session.role` sebagai teks "ADMIN"/"GUDANG", ganti jadi "Staf"/"Admin Gudang")

Untuk 5 item di atas, MINTA Claude Code baca file lama yang bersangkutan dulu (misal `src/app/permintaan/page.tsx`), baru direvisi mengikuti perubahan actions.ts di atas - jangan bikin dari nol biar UI/styling yang udah ada tetap konsisten.

---

## Setelah semua diterapkan

```bash
npx prisma validate
npx prisma db push   # akan ada prompt data-loss untuk kolom lama yang dihapus - aman di-accept kalau belum ada data produksi FPP/FPKB asli
npx prisma generate
npm run build        # pastikan build lolos sebelum push
```
