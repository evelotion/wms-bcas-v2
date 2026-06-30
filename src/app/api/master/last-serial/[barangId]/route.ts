export const dynamic = 'force-dynamic';

import prisma from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ barangId: string }> }
) {
  const { barangId } = await params;

  if (!barangId) {
    return NextResponse.json({ error: 'barangId is required' }, { status: 400 });
  }

  try {
    const lastBatch = await prisma.batch_Barang.findFirst({
      where: {
        barangId: barangId,
        nomorator_akhir: {
          not: null,
        },
      },
      orderBy: {
        tanggal_masuk: 'desc',
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