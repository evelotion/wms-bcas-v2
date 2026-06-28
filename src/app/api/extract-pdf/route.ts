import { prisma } from '@/prisma';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { barangId: string } }
) {
  const { barangId } = params;

  if (!barangId) {
    return NextResponse.json({ error: 'barangId is required' }, { status: 400 });
  }

  try {
    const lastBatch = await prisma.batch_Barang.findFirst({
      where: {
        barangId: barangId,
        nomorator_akhir: {
          not: null, // Hanya cari batch yang punya nomorator
        },
      },
      orderBy: {
        tanggal_masuk: 'desc', // Ambil batch yang paling baru masuk
      },
      select: {
        nomorator_akhir: true,
      },
    });

    return NextResponse.json({
      last_serial: lastBatch?.nomorator_akhir || null,
    });

  } catch (error) {
    console.error('Failed to fetch last serial:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}