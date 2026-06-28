import { PrismaClient, Master_Barang, StatusPermintaan, Prisma } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

const prisma = new PrismaClient();

// Schema validasi menggunakan Zod. Ini menjadi satu-satunya sumber kebenaran (single source of truth)
// untuk bentuk data dan tipenya.
const PermintaanDetailSchema = z.object({
  sku: z.string().min(1, { message: "SKU tidak boleh kosong." }),
  qty_diminta: z.coerce.number().int({ message: "Qty harus berupa bilangan bulat." }).positive({ message: "Qty harus lebih dari 0." }),
  keterangan: z.string().optional().nullable(),
});

const PermintaanFromPdfSchema = z.object({
  nomor_fpp: z.string().min(1, { message: "Nomor FPP tidak boleh kosong." }),
  cabang: z.string().min(1, { message: "Cabang tidak boleh kosong." }),
  pic_nama: z.string().min(1, { message: "Nama PIC tidak boleh kosong." }),
  keterangan: z.string().optional().nullable(),
  details: z.array(PermintaanDetailSchema).min(1, { message: "Harus ada minimal 1 item dalam permintaan." }),
});

// Kita bisa mendapatkan tipe data TypeScript langsung dari schema Zod
type PermintaanFromPdfPayload = z.infer<typeof PermintaanFromPdfSchema>;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // 1. Validasi data yang masuk menggunakan Zod
    const validation = PermintaanFromPdfSchema.safeParse(req.body);
    if (!validation.success) {
      // Zod memberikan pesan error yang sangat detail
      return res.status(400).json({ message: 'Data payload tidak valid.', errors: validation.error.flatten() });
    }
    const payload = validation.data;


    // 2. Cek duplikasi Nomor FPP
    const existingFpp = await prisma.permintaan_Header.findUnique({
      where: { nomor_fpp: payload.nomor_fpp },
    });
    if (existingFpp) {
      return res.status(409).json({ message: `FPP dengan nomor ${payload.nomor_fpp} sudah pernah diinput.` });
    }

    // 3. Ambil semua SKU dari payload dan cari di database sekali jalan
    const skus = payload.details.map((item) => item.sku);
    const foundBarang = await prisma.master_Barang.findMany({
      where: {
        sku: { in: skus },
      },
    });

    // Buat Map untuk pencarian cepat (O(1) lookup)
    const barangMap = new Map<string, Master_Barang>(
      foundBarang.map((b) => [b.sku, b])
    );

    const permintaanDetailsData = [];
    for (const item of payload.details) {
      const barang = barangMap.get(item.sku);
      if (!barang) {
        // Jika ada satu saja SKU yang tidak ditemukan, batalkan seluruh proses
        return res.status(400).json({ message: `Barang dengan SKU '${item.sku}' tidak ditemukan di master data.` });
      }
      permintaanDetailsData.push({
        barangId: barang.id,
        qty_diminta: item.qty_diminta,
        keterangan: item.keterangan,
        // Status item default sudah diatur di schema.prisma, jadi tidak perlu diset di sini
      });
    }

    // 4. Buat Header dan Detail dalam satu transaksi atomik
    const newPermintaan = await prisma.permintaan_Header.create({
      data: {
        nomor_fpp: payload.nomor_fpp,
        cabang: payload.cabang,
        pic_nama: payload.pic_nama,
        keterangan: payload.keterangan,
        status: StatusPermintaan.DRAFT, // Status awal dari Enum
        details: {
          createMany: {
            data: permintaanDetailsData,
          },
        },
      },
      include: {
        details: true, // Sertakan detail dalam response
      },
    });

    return res.status(201).json({ message: 'Permintaan berhasil dibuat dari PDF.', data: newPermintaan });

  } catch (error: any) {
    console.error("Gagal membuat permintaan dari PDF:", error);
    // Handle error dari Prisma secara spesifik jika perlu
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(409).json({ message: `Error database: ${error.code}`, details: error.message });
    }
    return res.status(500).json({ message: 'Terjadi kesalahan di server.', error: error.message });
  }
}