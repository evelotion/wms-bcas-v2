"use client";

import React, { useEffect, useState } from "react";
import { getOutstandingList, fulfillOutstanding, cancelOutstanding } from "@/app/permintaan/actions";
import { generateFPKB } from "@/lib/generateFpkb";
import { Archive, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Clock, Trash2, X, CreditCard as Edit3 } from "lucide-react";

export default function OutstandingPage() {
  const [outstandingList, setOutstandingList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // State untuk modal pemenuhan
  const [activeOut, setActiveOut] = useState<any | null>(null);
  const [fulfillQty, setFulfillQty] = useState<number>(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getOutstandingList();
    setOutstandingList(data || []);
    setIsLoading(false);
  };

  const openFulfillment = (out: any) => {
    setActiveOut(out);
    setFulfillQty(out.qty_sisa);
  };

  const closeFulfillment = () => {
    setActiveOut(null);
    setFulfillQty(0);
  };

  const handleFulfill = async () => {
    if (!activeOut) return;
    if (!confirm(`Penuhi sebanyak ${fulfillQty} ${activeOut.barang.satuan}? Stok fisik akan terpotong.`)) return;

    setProcessingId(activeOut.id);
    const res = await fulfillOutstanding(activeOut.id, fulfillQty);

    if (res.success && res.rawDetails) {
      alert(`Berhasil dipenuhi! Nomor FPKB Baru: ${res.nomor_fpkb}`);

      let grandTotal = 0;
      const pdfItems = res.rawDetails.map((d: any) => {
        const harga = d.harga_satuan || 0;
        const total = d.qty_disetujui * harga;
        grandTotal += total;
        return {
          kode: d.barang?.sku,
          nama: d.barang?.nama,
          jumlahPack: d.qty_disetujui,
          jumlahSatuan: `${d.qty_disetujui} ${d.barang?.satuan}`,
          hargaSatuan: harga,
          total: total,
          keterangan: `Susulan FPP: ${activeOut.header.nomor_fpp}`
        };
      });

      generateFPKB({
        nomorFpkb: res.nomor_fpkb,
        noFpp: activeOut.header.nomor_fpp,
        tglRequest: new Date().toLocaleDateString("id-ID"),
        cabang: activeOut.header.cabang,
        pic: activeOut.header.pic_nama || "PIC Cabang",
        items: pdfItems,
        grandTotal: grandTotal,
        pembuat: "Admin Gudang"
      });

      closeFulfillment();
      fetchData();
    } else {
      alert("Error: " + res.error);
    }
    setProcessingId(null);
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Yakin ingin membatalkan/menghapus tagihan barang ini permanen?")) return;
    const res = await cancelOutstanding(id);
    if (res.success) fetchData();
  };

  return (
    <div className="w-full space-y-6 pb-10">
      <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border-l-4 border-l-orange-500">
        <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
          <Archive size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Daftar Outstanding</h1>
          <p className="text-sm text-slate-500">Monitoring & Penuhi barang FPP yang tertunda.</p>
        </div>
      </div>

      <div className="glass-panel flex flex-col rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat data utang stok...</div>
        ) : outstandingList.length === 0 ? (
          <div className="p-12 flex flex-col items-center text-slate-400 text-sm bg-white/20">
            <CheckCircle size={48} className="text-emerald-300 mb-3" />
            Wah mantap, nggak ada utang barang sama sekali!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Tgl Adjustment</th>
                  <th className="px-6 py-4">No. FPP Asal</th>
                  <th className="px-6 py-4">Cabang</th>
                  <th className="px-6 py-4">Detail Barang</th>
                  <th className="px-6 py-4 text-right">Sisa Kurang</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/40">
                {outstandingList.map((out) => (
                  <tr
                    key={out.id}
                    onClick={() => openFulfillment(out)}
                    className="hover:bg-orange-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 text-slate-500">{new Date(out.createdAt).toLocaleDateString('id-ID')}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{out.header.nomor_fpp}</td>
                    <td className="px-6 py-4 text-slate-700">{out.header.cabang}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-blue-700">{out.barang.nama}</div>
                      <div className="text-xs text-slate-500">SKU: {out.barang.sku}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-red-600 text-base inline-flex items-center gap-1">
                        {out.qty_sisa} <AlertCircle size={14} />
                      </span>
                      <span className="text-xs text-slate-500 block">{out.barang.satuan}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Edit3 className="inline text-orange-500" size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PEMENUHAN OUTSTANDING */}
      {activeOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Archive className="text-orange-500" size={22}/> Pemenuhan Outstanding
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">{activeOut.header.nomor_fpp} — {activeOut.header.cabang}</p>
              </div>
              <button onClick={closeFulfillment} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <X size={20}/>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="font-bold text-slate-800">{activeOut.barang.nama}</div>
                <div className="text-xs text-slate-500 mb-3">SKU: {activeOut.barang.sku}</div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Sisa Utang:</span>
                  <span className="font-bold text-red-600">{activeOut.qty_sisa} {activeOut.barang.satuan}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Qty Pemenuhan</label>
                <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50">
                  <input
                    type="number"
                    min="1"
                    max={activeOut.qty_sisa}
                    value={fulfillQty}
                    onChange={(e) => setFulfillQty(parseInt(e.target.value) || 0)}
                    className="w-full bg-transparent text-center font-bold text-blue-700 outline-none text-lg"
                  />
                  <span className="text-sm text-slate-500">{activeOut.barang.satuan}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Maksimal: {activeOut.qty_sisa} {activeOut.barang.satuan}</p>
              </div>

              <p className="text-xs text-slate-500 bg-orange-50 border border-orange-100 rounded-lg p-3">
                Pastikan fisik barang sudah tersedia di rak. Stok akan terpotong otomatis (FIFO) dan FPKB susulan tergenerate dengan harga satuan dari batch.
              </p>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <button
                onClick={() => { handleCancel(activeOut.id); closeFulfillment(); }}
                className="text-red-500 hover:bg-red-50 px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-1.5 transition-colors"
              >
                <Trash2 size={16}/> Batal Utang
              </button>
              <button
                onClick={handleFulfill}
                disabled={processingId === activeOut.id || fulfillQty <= 0 || fulfillQty > activeOut.qty_sisa}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {processingId === activeOut.id ? <Clock size={16} className="animate-spin"/> : <CheckCircle size={16}/>}
                Penuhi & Cetak FPKB
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
