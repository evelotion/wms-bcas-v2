import { notFound } from "next/navigation";
import { getDetailFpkb } from "@/app/fpkb/actions";
import BastPrintView, { BastPrintItem } from "@/components/print/BastPrintView";

export default async function BastPrintPage({ params }: { params: { id: string } }) {
  const fpkb = await getDetailFpkb(params.id);
  if (!fpkb || !fpkb.nomor_bast) notFound();

  const items: BastPrintItem[] = fpkb.items.map((it: any) => ({
    kode: it.barang?.sku || "N/A",
    nama: it.barang?.nama || "Item Unknown",
    qty: it.qty_realisasi,
    unit: it.barang?.satuan || "Pcs",
    keterangan: "",
  }));

  const tglDokumen = fpkb.tanggal_serah_terima
    ? new Date(fpkb.tanggal_serah_terima).toLocaleDateString("id-ID")
    : new Date(fpkb.createdAt).toLocaleDateString("id-ID");

  return (
    <BastPrintView
      data={{
        nomorBast: fpkb.nomor_bast,
        namaPenerima: fpkb.header?.pic_nama || "",
        noDokumenFpkb: fpkb.nomor_fpkb,
        tglDokumen,
        cabang: fpkb.header?.cabang || "-",
        jenisAset: "Non Aktiva",
        items,
        namaMenyerahkan: fpkb.gudang?.nama || "",
        jabatanMenyerahkan: "Staff Gudang",
      }}
    />
  );
}
