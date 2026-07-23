import { notFound } from "next/navigation";
import { getDetailFpkb } from "@/app/fpkb/actions";
import FpkbPrintView, { FpkbPrintItem } from "@/components/print/FpkbPrintView";

export default async function FpkbPrintPage({ params }: { params: { id: string } }) {
  const fpkb = await getDetailFpkb(params.id);
  if (!fpkb) notFound();

  const isAdjusted = fpkb.status !== "MENUNGGU_ADJUSTMENT";

  const items: FpkbPrintItem[] = fpkb.items.map((it: any) => {
    const isiPerPack = it.barang?.isi_per_satuan_besar || 0;
    const hasSatuanBesar = !!it.barang?.satuan_besar && isiPerPack > 0;
    const hargaSatuan = it.harga_satuan || 0;
    const total = hargaSatuan * it.qty_diminta;
    const satuan = it.barang?.satuan || "Pcs";
    return {
      kode: it.barang?.sku || "N/A",
      nama: it.barang?.nama || "Item Unknown",
      jmlPack: hasSatuanBesar ? Math.ceil(it.qty_diminta / isiPerPack) : "-",
      jmlSatuan: `${it.qty_diminta} ${satuan}`,
      hargaSatuan,
      total,
      realisasi: isAdjusted ? `${it.qty_realisasi} ${satuan}` : "",
      keterangan: "",
    };
  });

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

  const tglDokumen = new Date(fpkb.createdAt).toLocaleDateString("id-ID");

  return (
    <FpkbPrintView
      data={{
        nomorFpkb: fpkb.nomor_fpkb,
        noFpp: fpkb.header?.nomor_fpp || "-",
        tglDokumen,
        tglRequest: tglDokumen,
        cabang: fpkb.header?.cabang || "-",
        pic: fpkb.header?.pic_nama || "",
        items,
        grandTotal,
      }}
    />
  );
}
