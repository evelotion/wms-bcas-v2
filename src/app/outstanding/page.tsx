"use client";

import React, { useEffect, useState } from "react";
import { getOutstandingList, resolveOutstandingItem } from "./actions";
import { getSession } from "@/app/login/actions";
import { Archive, PackageCheck, Clock, AlertTriangle } from "lucide-react";

export default function OutstandingPage() {
  const [outstandingList, setOutstandingList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  
  // State untuk nyimpen inputan qty per item
  const [fulfillQty, setFulfillQty] = useState<Record<string, number>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    getSession().then((session) => {
      if (session) setUserId(session.id);
    });
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getOutstandingList();
    setOutstandingList(data || []);
    
    // Set default value inputan ke maksimal sisa hutang
    const initQty: Record<string, number> = {};
    data.forEach(item => { initQty[item.id] = item.qty_sisa; });
    setFulfillQty(initQty);
    
    setIsLoading(false);
  };

  const handleQtyChange = (id: string, value: number, max: number) => {
    // Cegah input melebihi sisa hutang atau minus
    let val = Math.max(0, value);
    if (val > max) val = max;
    setFulfillQty(prev => ({ ...prev, [id]: val }));
  };

  const handleResolve = async (item: any) => {
    const qtyToFulfill = fulfillQty[item.id];
    if (qtyToFulfill <= 0) return alert("Jumlah yang disusulkan harus lebih dari 0!");

    if (!confirm(`Susulkan ${qtyToFulfill} ${item.barang.satuan} untuk ${item.barang.nama}?`)) return;
    
    setProcessingId(item.id);
    const res = await resolveOutstandingItem(item.id, qtyToFulfill, userId);
    
    if (res.success) {
      alert("✅ Berhasil! Silakan ambil barang di lokasi berikut:\n\n" + res.instruksi?.join("\n"));
      fetchData(); // Refresh data
    } else {
      alert("❌ Gagal: " + res.error);
    }
    
    setProcessingId(null);
  };

  return (
    <div className="w-full space-y-6 pb-10">
      {/* HEADER */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-orange-500">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
            <Archive size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Outstanding Barang</h1>
            <p className="text-sm text-slate-500">
              Daftar hutang pengiriman barang ke cabang akibat stok gudang kosong.
            </p>
          </div>
        </div>
      </div>

      {/* TABLE OUTSTANDING */}
      <div className="glass-panel flex flex-col rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Informasi FPKB</th>
                <th className="px-6 py-4">Barang Ngutang</th>
                <th className="px-6 py-4 text-center">Sisa Hutang</th>
                <th className="px-6 py-4 text-center">Qty Disusulkan</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8">Memuat data outstanding...</td></tr>
              ) : outstandingList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <PackageCheck size={48} className="mb-3 text-emerald-400 opacity-50" />
                      <p className="font-bold text-lg text-slate-500">Gudang Bersih!</p>
                      <p className="text-sm">Tidak ada tunggakan barang ke cabang saat ini.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                outstandingList.map((item: any) => (
                  <tr key={item.id} className="hover:bg-orange-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{item.header.nomor_fpkb || item.header.nomor_fpp}</div>
                      <div className="text-xs font-medium text-slate-500 mt-1">Cabang: {item.header.cabang}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <Clock size={12} /> {new Date(item.createdAt).toLocaleDateString("id-ID")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{item.barang.nama}</div>
                      <div className="text-xs text-slate-500">{item.barang.sku}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-bold flex items-center justify-center gap-1 w-fit mx-auto">
                        <AlertTriangle size={14} /> {item.qty_sisa} {item.barang.satuan}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="number"
                        min="0"
                        max={item.qty_sisa}
                        value={fulfillQty[item.id] || 0}
                        onChange={(e) => handleQtyChange(item.id, parseInt(e.target.value) || 0, item.qty_sisa)}
                        disabled={processingId === item.id}
                        className="w-20 px-2 py-1.5 text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-bold text-orange-700 bg-white"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleResolve(item)}
                        disabled={processingId === item.id || fulfillQty[item.id] <= 0}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-md shadow-orange-500/20 disabled:opacity-50"
                      >
                        {processingId === item.id ? "Memproses..." : "Penuhi"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}