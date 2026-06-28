import prisma from '../../../../../lib/prisma'; // Sesuaikan kembali ke '@/lib/prisma' kalau relative path ini udah nggak perlu
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
        // PERBAIKAN: Pakai kolom 'nomorator' sesuai dengan yang ada di schema.prisma lo
        nomorator: {
          not: null, 
        },
      },
      orderBy: {
        tanggal_masuk: 'desc', 
      },
      select: {
        nomorator: true, // PERBAIKAN DI SINI JUGA
      },
    });

    return NextResponse.json({
      last_serial: lastBatch?.nomorator || null, // DAN DI SINI
    });

  } catch (error) {
    console.error('Failed to fetch last serial:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}