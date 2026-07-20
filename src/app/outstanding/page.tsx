"use client";

import React, { useEffect, useState } from "react";
import { getOutstandingList, tutupOutstanding, prosesUlangOutstanding } from "./actions";
import { getSession } from "@/app/login/actions";
import { Archive, PackageCheck, Clock, AlertTriangle, RefreshCw, XCircle } from "lucide-react";

export default function OutstandingPage() {
  const [outstandingList, setOutstandingList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    getSession().then((session) => {
      if (session) setUserRole(session.role);
    });
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getOutstandingList();
    setOutstandingList(data || []);
    setIsLoading(false);
  };

  const handleTutup = async (item: any) => {
    if (!confirm(`Tutup permanen outstanding ${item.barang.nama} (${item.qty_sisa} ${item.barang.satuan})? Item ini TIDAK akan disusulkan lagi.`)) return;

    setProcessingId(item.id);
    const res = await tutupOutstanding([item.id]);
    if (res.success) {
      alert("✅ Outstanding ditutup.");
      fetchData();
    } else {
      alert("❌ Gagal: " + res.error);
    }
    setProcessingId(null);
  };

  const handleProsesUlang = async (item: any) => {
    if (!confirm(`Terbitkan FPKB baru untuk menyusulkan ${item.barang.nama} (${item.qty_sisa} ${item.barang.satuan})?`)) return;

    setProcessingId(item.id);
    const res = await prosesUlangOutstanding([item.id]);
    if (res.success) {
      alert(`✅ FPKB baru diterbitkan: #${res.nomor_fpkb}\nSilakan buka halaman FPKB untuk proses adjustment.`);
      fetchData();
    } else {
      alert("❌ Gagal: " + res.error);
    }
    setProcessingId(null);
  };

  const canAct = userRole === "ADMIN";

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
              {canAct
                ? "Daftar hutang pengiriman barang ke cabang. Tutup permanen atau terbitkan FPKB susulan untuk diproses ulang Admin Gudang."
                : "Daftar hutang pengiriman barang ke cabang akibat stok gudang kosong."}
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
                <th className="px-6 py-4">Informasi FPP / FPKB Asal</th>
                <th className="px-6 py-4">Barang Ngutang</th>
                <th className="px-6 py-4 text-center">Sisa Hutang</th>
                {canAct && <th className="px-6 py-4 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-8">Memuat data outstanding...</td></tr>
              ) : outstandingList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12">
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
                      <div className="font-bold text-slate-800">FPP #{item.header.nomor_fpp}</div>
                      <div className="text-xs font-medium text-slate-500 mt-1">Cabang: {item.header.cabang} · {item.header.wilayah === "JABODETABEK" ? "JABODETABEK" : "NON-JABODETABEK"}</div>
                      {item.fpkbAsal && (
                        <div className="text-xs text-slate-400 mt-1">Dari FPKB #{item.fpkbAsal.nomor_fpkb}</div>
                      )}
                      {item.fpkbLanjutan && (
                        <div className="text-xs text-blue-500 flex items-center gap-1 mt-1">
                          <RefreshCw size={12} /> Sudah diterbitkan FPKB #{item.fpkbLanjutan.nomor_fpkb}
                        </div>
                      )}
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
                    {canAct && (
                      <td className="px-6 py-4">
                        {item.fpkbLanjutanId ? (
                          <span className="text-xs text-slate-400 italic block text-center">Sudah diproses ulang</span>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleProsesUlang(item)}
                              disabled={processingId === item.id}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-1"
                            >
                              <RefreshCw size={14} /> Proses Ulang
                            </button>
                            <button
                              onClick={() => handleTutup(item)}
                              disabled={processingId === item.id}
                              className="bg-slate-200 hover:bg-red-100 hover:text-red-600 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1"
                            >
                              <XCircle size={14} /> Tutup
                            </button>
                          </div>
                        )}
                      </td>
                    )}
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
