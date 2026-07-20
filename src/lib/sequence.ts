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
