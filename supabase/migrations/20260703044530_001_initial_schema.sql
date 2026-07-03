-- Create enums
CREATE TYPE "StatusBatch" AS ENUM ('QUARANTINE', 'AVAILABLE', 'DEPLETED');
CREATE TYPE "TipeMutasi" AS ENUM ('INBOUND', 'OUTBOUND', 'RETUR');
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GUDANG');
CREATE TYPE "StatusPermintaan" AS ENUM ('PENDING_GUDANG', 'PARTIAL', 'COMPLETED');
CREATE TYPE "StatusItem" AS ENUM ('FULFILLED', 'PARTIAL', 'OUTSTANDING', 'CANCELLED');

-- Master Barang
CREATE TABLE "Master_Barang" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sku" TEXT UNIQUE NOT NULL,
  "nama" TEXT NOT NULL,
  "kategori" TEXT NOT NULL,
  "satuan" TEXT NOT NULL,
  "batas_minimum" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Lokasi Rak
CREATE TABLE "Lokasi_Rak" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "gudang" TEXT NOT NULL,
  "lorong" TEXT NOT NULL,
  "rak" TEXT NOT NULL,
  "qr_code" TEXT UNIQUE NOT NULL
);

-- Batch Barang
CREATE TABLE "Batch_Barang" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "barangId" UUID NOT NULL REFERENCES "Master_Barang"("id") ON DELETE CASCADE,
  "lokasiId" UUID NOT NULL REFERENCES "Lokasi_Rak"("id") ON DELETE CASCADE,
  "tanggal_masuk" TIMESTAMP DEFAULT NOW(),
  "qty_awal" INTEGER NOT NULL,
  "qty_sisa" INTEGER NOT NULL,
  "harga_satuan" DOUBLE PRECISION NOT NULL,
  "supplier" TEXT,
  "nomorator_awal" TEXT,
  "nomorator_akhir" TEXT,
  "status" "StatusBatch" DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Item Seri
CREATE TABLE "Item_Seri" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "batchId" TEXT NOT NULL REFERENCES "Batch_Barang"("id") ON DELETE CASCADE,
  "nomor_seri" TEXT NOT NULL,
  "is_used" BOOLEAN DEFAULT FALSE
);

-- Mutasi Ledger
CREATE TABLE "Mutasi_Ledger" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "batchId" TEXT NOT NULL REFERENCES "Batch_Barang"("id") ON DELETE CASCADE,
  "tipe_mutasi" "TipeMutasi" NOT NULL,
  "qty_perubahan" INTEGER NOT NULL,
  "saldo_akhir" INTEGER NOT NULL,
  "referensi" TEXT,
  "keterangan" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "createdBy" TEXT NOT NULL
);

-- User
CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "username" TEXT UNIQUE NOT NULL,
  "nama" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" "Role" DEFAULT 'ADMIN',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Permintaan Header
CREATE TABLE "Permintaan_Header" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "nomor_fpp" TEXT UNIQUE NOT NULL,
  "nomor_fpkb" TEXT UNIQUE,
  "cabang" TEXT NOT NULL,
  "pic_nama" TEXT NOT NULL,
  "status" "StatusPermintaan" DEFAULT 'PENDING_GUDANG',
  "keterangan" TEXT,
  "adminId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "gudangId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Permintaan Detail
CREATE TABLE "Permintaan_Detail" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "headerId" TEXT NOT NULL REFERENCES "Permintaan_Header"("id") ON DELETE CASCADE,
  "barangId" UUID NOT NULL REFERENCES "Master_Barang"("id") ON DELETE CASCADE,
  "qty_diminta" INTEGER NOT NULL,
  "qty_disetujui" INTEGER DEFAULT 0,
  "status_item" "StatusItem" DEFAULT 'OUTSTANDING',
  "keterangan" TEXT
);

-- Permintaan Outstanding
CREATE TABLE "Permintaan_Outstanding" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "headerId" TEXT NOT NULL REFERENCES "Permintaan_Header"("id") ON DELETE CASCADE,
  "barangId" UUID NOT NULL REFERENCES "Master_Barang"("id") ON DELETE CASCADE,
  "qty_sisa" INTEGER NOT NULL,
  "status" "StatusItem" DEFAULT 'OUTSTANDING',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Create indexes for foreign keys
CREATE INDEX idx_batch_barang ON "Batch_Barang"("barangId");
CREATE INDEX idx_batch_lokasi ON "Batch_Barang"("lokasiId");
CREATE INDEX idx_mutasi_batch ON "Mutasi_Ledger"("batchId");
CREATE INDEX idx_item_seri_batch ON "Item_Seri"("batchId");
CREATE INDEX idx_detail_header ON "Permintaan_Detail"("headerId");
CREATE INDEX idx_detail_barang ON "Permintaan_Detail"("barangId");
CREATE INDEX idx_outstanding_header ON "Permintaan_Outstanding"("headerId");
CREATE INDEX idx_outstanding_barang ON "Permintaan_Outstanding"("barangId");