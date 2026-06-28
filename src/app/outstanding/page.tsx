"use client";

import React, { useEffect, useState } from "react";
import { getOutstandingList, fulfillOutstanding, cancelOutstanding } from "@/app/permintaan/actions";
import { generateFPKB } from "@/lib/generateFpkb";
import { Archive, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Clock, Trash2 } from "lucide-react";

export default function OutstandingPage() {
  const [outstandingList, setOutstandingList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State untuk baris yang di-expand & nominal yang mau dipenuhi
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [fulfillQty, setFulfillQty] = useState<number>(0);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getOutstandingList();
    setOutstandingList(data || []);
    setIsLoading(false);
  };

  const toggleRow = (out: any) => {
    if (expandedRow === out.id) {
      setExpandedRow(null);
    } else {
      setExpandedRow(out.id);
      setFulfillQty(out.qty_sisa); // Set default input ke sisa maksimal
    }
  };

  const handleFulfill = async (out: any) => {
    if (!confirm(`Penuhi sebanyak ${fulfillQty} ${out.barang.satuan}? Stok fisik akan terpotong.`)) return;
    
    setProcessingId(out.id);
    const res = await fulfillOutstanding(out.id, fulfillQty);
    
    if (res.success && res.rawDetails) {
      alert(`Berhasil dipenuhi! Nomor FPKB Baru: ${res.nomor_fpkb}`);
      
      // Lempar ke modul PDF
      const pdfItems = res.rawDetails.map((d: any) => ({
        kode: d.barang?.sku,
        nama: d.barang?.nama,
        jumlahPack: d.qty_disetujui,
        jumlahSatuan: `${d.qty_disetujui} ${d.barang?.satuan}`,
        hargaSatuan: 0,
        total: 0,
        keterangan: `Susulan FPP: ${out.header.nomor_fpp}`
      }));

      generateFPKB({
        nomorFpkb: res.nomor_fpkb,
        tglRequest: new Date().toLocaleDateString("id-ID"),
        cabang: out.header.cabang,
        pic: out.header.pic_nama || "PIC Cabang",
        items: pdfItems,
        grandTotal: 0,
        pembuat: "Admin Gudang"
      });

      setExpandedRow(null);
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
                  <React.Fragment key={out.id}>
                    <tr onClick={() => toggleRow(out)} className={`hover:bg-orange-50/50 cursor-pointer transition-colors ${expandedRow === out.id ? 'bg-orange-50/50' : ''}`}>
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
                        {expandedRow === out.id ? <ChevronUp className="inline text-slate-400"/> : <ChevronDown className="inline text-slate-400"/>}
                      </td>
                    </tr>

                    {/* EXPANDED ACTION PANEL */}
                    {expandedRow === out.id && (
                      <tr className="bg-slate-50/50 border-b-2 border-b-orange-100">
                        <td colSpan={6} className="px-6 py-6">
                          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                              <p className="font-bold text-slate-800">Proses Pemenuhan Barang</p>
                              <p className="text-xs text-slate-500">Pastikan fisik barang sudah tersedia di rak.</p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleCancel(out.id)} className="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-1">
                                <Trash2 size={16} /> Batal
                              </button>
                              
                              <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-1 bg-slate-50">
                                <span className="text-sm font-medium text-slate-600">Qty:</span>
                                <input type="number" min="1" max={out.qty_sisa} value={fulfillQty} onChange={(e) => setFulfillQty(parseInt(e.target.value) || 0)} className="w-16 bg-transparent text-center font-bold text-blue-700 outline-none" />
                              </div>

                              <button onClick={() => handleFulfill(out)} disabled={processingId === out.id || fulfillQty <= 0 || fulfillQty > out.qty_sisa} className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md disabled:opacity-50 flex items-center gap-2">
                                {processingId === out.id ? <Clock size={16} className="animate-spin"/> : <CheckCircle size={16}/>}
                                Penuhi & Cetak
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}