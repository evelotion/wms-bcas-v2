"use client";

import React, { useEffect, useState } from "react";
import { getFpkbMenungguAdjustment, getFpkbMenungguSerahTerima, prosesAdjustmentFpkb, uploadServahTerimaFpkb } from "./actions";
import { getSession } from "@/app/login/actions";
import { generateFPKB } from "@/lib/generateFpkb";
import { generateBAST } from "@/lib/generateBast";
import { ClipboardCheck, Clock, ChevronDown, ChevronUp, PackageSearch, Truck, Printer, UploadCloud, ShieldAlert } from "lucide-react";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function FpkbPage() {
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [menungguAdjustment, setMenungguAdjustment] = useState<any[]>([]);
  const [menungguSerahTerima, setMenungguSerahTerima] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [expandedAdjust, setExpandedAdjust] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [expandedUpload, setExpandedUpload] = useState<string | null>(null);
  const [uploadForms, setUploadForms] = useState<Record<string, { fpkbFile?: File; bastFile?: File; airwaybill: string }>>({});

  useEffect(() => {
    getSession().then((session) => {
      if (session) {
        setUserRole(session.role);
        setUserId(session.id);
      }
    });
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [adjustList, serahList] = await Promise.all([
      getFpkbMenungguAdjustment(),
      getFpkbMenungguSerahTerima(),
    ]);
    setMenungguAdjustment(adjustList || []);
    setMenungguSerahTerima(serahList || []);
    setIsLoading(false);
  };

  const toggleAdjustRow = (fpkb: any) => {
    if (expandedAdjust === fpkb.id) {
      setExpandedAdjust(null);
      return;
    }
    setExpandedAdjust(fpkb.id);
    const initAdj: Record<string, number> = {};
    fpkb.items.forEach((it: any) => { initAdj[it.id] = it.qty_diminta; });
    setAdjustments(initAdj);
  };

  const handleQtyChange = (itemId: string, value: number, max: number) => {
    let val = Math.max(0, value);
    if (val > max) val = max;
    setAdjustments((prev) => ({ ...prev, [itemId]: val }));
  };

  const printFpkb = (fpkb: any, itemsWithRealisasi: { itemId: string; qtyRealisasi: number }[]) => {
    const pdfItems = fpkb.items.map((it: any) => {
      const adj = itemsWithRealisasi.find((a) => a.itemId === it.id);
      const realisasi = adj ? adj.qtyRealisasi : it.qty_realisasi;
      return {
        kode: it.barang?.sku || "N/A",
        nama: it.barang?.nama || "Item Unknown",
        jumlahPack: it.qty_diminta,
        jumlahSatuan: `${it.qty_diminta} ${it.barang?.satuan || "Pcs"}`,
        hargaSatuan: 0,
        total: 0,
        realisasiPack: realisasi,
        realisasiSatuan: `${realisasi} ${it.barang?.satuan || "Pcs"}`,
        keterangan: "",
      };
    });

    generateFPKB({
      nomorFpkb: fpkb.nomor_fpkb,
      noFpp: fpkb.header?.nomor_fpp,
      tglRequest: new Date(fpkb.createdAt).toLocaleDateString("id-ID"),
      cabang: fpkb.header?.cabang || "-",
      pic: fpkb.header?.pic_nama,
      items: pdfItems,
      grandTotal: 0,
    });

    if (fpkb.header?.wilayah === "NON_JABODETABEK") {
      generateBAST({
        nomorBast: fpkb.nomor_bast || "DRAFT",
        noDokumenFpkb: fpkb.nomor_fpkb,
        tglDokumen: new Date(fpkb.createdAt).toLocaleDateString("id-ID"),
        cabang: fpkb.header?.cabang || "-",
        items: fpkb.items.map((it: any) => {
          const adj = itemsWithRealisasi.find((a) => a.itemId === it.id);
          const realisasi = adj ? adj.qtyRealisasi : it.qty_realisasi;
          return {
            kode: it.barang?.sku || "N/A",
            nama: it.barang?.nama || "Item Unknown",
            qty: realisasi,
            unit: it.barang?.satuan || "Pcs",
            keterangan: "",
          };
        }),
      });
    }
  };

  const handleProsesAdjustment = async (fpkb: any) => {
    if (!confirm("Proses adjustment FPKB ini? Stok akan langsung terpotong sesuai realisasi yang diisi.")) return;
    setProcessingId(fpkb.id);

    const formattedAdjustments = fpkb.items.map((it: any) => ({
      itemId: it.id,
      qtyRealisasi: adjustments[it.id] ?? it.qty_diminta,
    }));

    const res = await prosesAdjustmentFpkb(fpkb.id, formattedAdjustments, userId);

    if (res.success) {
      if (res.instruksi && res.instruksi.length > 0) {
        alert("✅ Adjustment berhasil! Ambil barang di lokasi berikut:\n\n" + res.instruksi.join("\n"));
      } else {
        alert("✅ Adjustment berhasil!");
      }
      printFpkb(fpkb, formattedAdjustments);
      setExpandedAdjust(null);
      fetchData();
    } else {
      alert("❌ Gagal: " + res.error);
    }
    setProcessingId(null);
  };

  const toggleUploadRow = (fpkbId: string) => {
    setExpandedUpload(expandedUpload === fpkbId ? null : fpkbId);
    if (!uploadForms[fpkbId]) {
      setUploadForms((prev) => ({ ...prev, [fpkbId]: { airwaybill: "" } }));
    }
  };

  const handleUploadSubmit = async (fpkb: any) => {
    const form = uploadForms[fpkb.id];
    const isJabodetabek = fpkb.header?.wilayah === "JABODETABEK";

    if (!form?.fpkbFile) return alert("File FPKB yang sudah ditandatangani wajib diupload.");
    if (!isJabodetabek && !form?.bastFile) return alert("Wilayah NON-JABODETABEK wajib upload BAST juga.");
    if (!isJabodetabek && !form?.airwaybill) return alert("Wilayah NON-JABODETABEK wajib isi nomor Airwaybill.");

    setProcessingId(fpkb.id);
    try {
      const fileFpkbBase64 = await fileToBase64(form.fpkbFile);
      const fileBastBase64 = form.bastFile ? await fileToBase64(form.bastFile) : undefined;

      const res = await uploadServahTerimaFpkb(fpkb.id, {
        fileFpkbBase64,
        fileBastBase64,
        nomorAirwaybill: form.airwaybill || undefined,
      });

      if (res.success) {
        alert("✅ Dokumen serah terima berhasil diupload. FPKB selesai.");
        setExpandedUpload(null);
        fetchData();
      } else {
        alert("❌ Gagal: " + res.error);
      }
    } catch (err) {
      alert("❌ Gagal membaca file yang diupload.");
    }
    setProcessingId(null);
  };

  if (userRole && userRole !== "GUDANG") {
    return (
      <div className="w-full space-y-6 pb-10">
        <div className="glass-panel p-10 rounded-2xl flex flex-col items-center justify-center text-center gap-3 border-l-4 border-l-slate-300">
          <ShieldAlert size={40} className="text-slate-400" />
          <h1 className="text-xl font-bold text-slate-700">Khusus Admin Gudang</h1>
          <p className="text-sm text-slate-500 max-w-md">
            Halaman FPKB (adjustment stok & serah terima) hanya bisa diproses oleh Admin Gudang. Staf dapat memantau status FPKB dari halaman Requisition.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-10">
      {/* HEADER */}
      <div className="glass-panel p-6 rounded-2xl flex items-center gap-3 border-l-4 border-l-blue-500">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
          <ClipboardCheck size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Antrean FPKB</h1>
          <p className="text-sm text-slate-500">Proses adjustment stok dan lengkapi dokumen serah terima.</p>
        </div>
      </div>

      {/* SECTION: MENUNGGU ADJUSTMENT */}
      <div className="glass-panel flex flex-col rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <PackageSearch size={18} className="text-amber-600" />
          <h2 className="font-bold text-slate-800">Menunggu Adjustment ({menungguAdjustment.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Nomor FPKB</th>
                <th className="px-6 py-4">Cabang</th>
                <th className="px-6 py-4">Wilayah</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-8">Memuat data...</td></tr>
              ) : menungguAdjustment.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-500">Tidak ada FPKB yang menunggu adjustment.</td></tr>
              ) : (
                menungguAdjustment.map((fpkb: any) => (
                  <React.Fragment key={fpkb.id}>
                    <tr onClick={() => toggleAdjustRow(fpkb)} className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${expandedAdjust === fpkb.id ? "bg-blue-50/50" : ""}`}>
                      <td className="px-6 py-4 font-bold text-slate-800">FPKB #{fpkb.nomor_fpkb}</td>
                      <td className="px-6 py-4 text-slate-700">{fpkb.header?.cabang}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{fpkb.header?.wilayah === "JABODETABEK" ? "JABODETABEK" : "NON-JABODETABEK"}</td>
                      <td className="px-6 py-4 text-right">
                        {expandedAdjust === fpkb.id ? <ChevronUp className="inline text-slate-400" /> : <ChevronDown className="inline text-slate-400" />}
                      </td>
                    </tr>
                    {expandedAdjust === fpkb.id && (
                      <tr className="bg-slate-50/50 border-b-2 border-b-blue-100">
                        <td colSpan={4} className="px-6 py-6">
                          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                            <h3 className="font-bold text-slate-800 mb-4">Adjustment Realisasi per Item</h3>
                            <table className="w-full text-left text-sm mb-4">
                              <thead className="border-b border-slate-200 text-slate-500 text-xs">
                                <tr>
                                  <th className="pb-2 font-medium">Item Barang</th>
                                  <th className="pb-2 font-medium w-32 text-center">Diminta</th>
                                  <th className="pb-2 font-medium w-32 text-center">Realisasi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {fpkb.items.map((it: any) => (
                                  <tr key={it.id} className="border-b border-slate-100 last:border-0">
                                    <td className="py-3">
                                      <div className="font-medium text-slate-800">{it.barang.nama}</div>
                                      <div className="text-xs text-slate-500">{it.barang.sku}</div>
                                    </td>
                                    <td className="py-3 text-center font-bold text-slate-600">{it.qty_diminta} {it.barang.satuan}</td>
                                    <td className="py-3 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        max={it.qty_diminta}
                                        value={adjustments[it.id] ?? it.qty_diminta}
                                        onChange={(e) => handleQtyChange(it.id, parseInt(e.target.value) || 0, it.qty_diminta)}
                                        className="w-20 px-2 py-1 text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700 bg-slate-50"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="flex justify-end pt-2 border-t border-slate-100">
                              <button
                                onClick={() => handleProsesAdjustment(fpkb)}
                                disabled={processingId === fpkb.id}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-500/30 disabled:opacity-50 flex items-center gap-2"
                              >
                                {processingId === fpkb.id ? <Clock size={16} className="animate-spin" /> : <Printer size={16} />}
                                Proses & Cetak FPKB
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION: MENUNGGU SERAH TERIMA */}
      <div className="glass-panel flex flex-col rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Truck size={18} className="text-blue-600" />
          <h2 className="font-bold text-slate-800">Menunggu Serah Terima ({menungguSerahTerima.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Nomor FPKB</th>
                <th className="px-6 py-4">Cabang</th>
                <th className="px-6 py-4">Wilayah</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-8">Memuat data...</td></tr>
              ) : menungguSerahTerima.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-500">Tidak ada FPKB yang menunggu serah terima.</td></tr>
              ) : (
                menungguSerahTerima.map((fpkb: any) => {
                  const isJabodetabek = fpkb.header?.wilayah === "JABODETABEK";
                  const form = uploadForms[fpkb.id] || { airwaybill: "" };
                  return (
                    <React.Fragment key={fpkb.id}>
                      <tr onClick={() => toggleUploadRow(fpkb.id)} className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${expandedUpload === fpkb.id ? "bg-blue-50/50" : ""}`}>
                        <td className="px-6 py-4 font-bold text-slate-800">FPKB #{fpkb.nomor_fpkb}</td>
                        <td className="px-6 py-4 text-slate-700">{fpkb.header?.cabang}</td>
                        <td className="px-6 py-4 text-slate-500 text-xs">{isJabodetabek ? "JABODETABEK" : "NON-JABODETABEK"}</td>
                        <td className="px-6 py-4 text-right">
                          {expandedUpload === fpkb.id ? <ChevronUp className="inline text-slate-400" /> : <ChevronDown className="inline text-slate-400" />}
                        </td>
                      </tr>
                      {expandedUpload === fpkb.id && (
                        <tr className="bg-slate-50/50 border-b-2 border-b-blue-100">
                          <td colSpan={4} className="px-6 py-6">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
                              <div className="flex justify-between items-center">
                                <h3 className="font-bold text-slate-800">Upload Dokumen Serah Terima</h3>
                                <button
                                  type="button"
                                  onClick={() => printFpkb(fpkb, fpkb.items.map((it: any) => ({ itemId: it.id, qtyRealisasi: it.qty_realisasi })))}
                                  className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                >
                                  <Printer size={14} /> Cetak Ulang
                                </button>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">File FPKB Sudah Ditandatangani (wajib)</label>
                                <input
                                  type="file"
                                  accept="application/pdf,image/*"
                                  onChange={(e) => setUploadForms((prev) => ({ ...prev, [fpkb.id]: { ...prev[fpkb.id], airwaybill: prev[fpkb.id]?.airwaybill || "", fpkbFile: e.target.files?.[0] } }))}
                                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                                />
                              </div>

                              {!isJabodetabek && (
                                <>
                                  <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">File BAST Sudah Ditandatangani (wajib)</label>
                                    <input
                                      type="file"
                                      accept="application/pdf,image/*"
                                      onChange={(e) => setUploadForms((prev) => ({ ...prev, [fpkb.id]: { ...prev[fpkb.id], airwaybill: prev[fpkb.id]?.airwaybill || "", bastFile: e.target.files?.[0] } }))}
                                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nomor Airwaybill (wajib)</label>
                                    <input
                                      type="text"
                                      value={form.airwaybill}
                                      onChange={(e) => setUploadForms((prev) => ({ ...prev, [fpkb.id]: { ...prev[fpkb.id], airwaybill: e.target.value } }))}
                                      placeholder="Contoh: JNE-1234567890"
                                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                  </div>
                                </>
                              )}

                              <div className="flex justify-end pt-2 border-t border-slate-100">
                                <button
                                  onClick={() => handleUploadSubmit(fpkb)}
                                  disabled={processingId === fpkb.id}
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-500/30 disabled:opacity-50 flex items-center gap-2"
                                >
                                  {processingId === fpkb.id ? <Clock size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                                  Upload & Selesaikan
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
