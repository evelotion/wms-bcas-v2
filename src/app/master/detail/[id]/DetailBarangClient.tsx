"use client";

import { useEffect, useState } from "react";
import { getDetailBarangLengkap } from "./actions";
import { Package, History, ArrowLeft, ArrowDownToLine, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export default function DetailBarangClient({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const result = await getDetailBarangLengkap(id);
      setData(result);
      setIsLoading(false);
    };
    fetchData();
  }, [id]);

  if (isLoading) return <div className="p-10 text-center text-slate-500 font-bold">Memuat Detail Barang...</div>;
  if (!data?.barang) return <div className="p-10 text-center text-red-500 font-bold">Barang tidak ditemukan!</div>;

  const { barang, totalStok, mutasi } = data;

  return (
    <div className="w-full space-y-6 pb-10">

      <div className="flex items-center gap-2 mb-4">
        <Link href="/master" className="p-2 bg-white rounded-xl shadow-sm text-slate-500 hover:text-blue-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">Detail & Kartu Stok</h1>
      </div>

      {/* Info Card Utama */}
      <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-blue-500 bg-gradient-to-br from-white to-slate-50">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-sm font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full w-fit">SKU: {barang.sku}</div>
              {barang.kode_gl && (
                <div className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full w-fit font-mono" title={barang.keterangan_gl || undefined}>
                  GL: {barang.kode_gl}
                </div>
              )}
            </div>
            <h2 className="text-3xl font-black text-slate-800">{barang.nama}</h2>
            <p className="text-slate-500 font-medium mt-1">Kategori: {barang.kategori} | Batas Min: {barang.batas_minimum} {barang.satuan}</p>
            {barang.keterangan_gl && (
              <p className="text-slate-400 text-xs font-medium mt-1">Keterangan GL: {barang.keterangan_gl}</p>
            )}
          </div>
          <div className="text-right bg-white p-4 rounded-xl shadow-sm border border-slate-100 min-w-[120px]">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Stok</p>
            <p className={`text-4xl font-black ${totalStok <= barang.batas_minimum ? 'text-red-600' : 'text-emerald-600'}`}>
              {totalStok} <span className="text-base text-slate-500 font-medium">{barang.satuan}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabel Log Transaksi (Kartu Stok) */}
      <div className="glass-panel flex flex-col rounded-2xl overflow-hidden mt-6">
        <div className="p-4 border-b border-white/40 bg-white/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <History size={18} className="text-blue-600"/> Log Keluar-Masuk Barang
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Tipe Transaksi</th>
                <th className="px-6 py-4 text-center">Perubahan</th>
                <th className="px-6 py-4 text-center">Saldo Akhir (Batch)</th>
                <th className="px-6 py-4">Keterangan / Referensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mutasi && mutasi.length > 0 ? (
                mutasi.map((m: any) => (
                  <tr key={m.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(m.createdAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {m.tipe_mutasi === "INBOUND" ? (
                        <span className="flex items-center gap-2 text-emerald-600">
                          <ArrowDownToLine size={14} /> Barang Masuk
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-red-600">
                          <ArrowUpRight size={14} /> Barang Keluar
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-4 text-center font-bold ${m.tipe_mutasi === "INBOUND" ? 'text-emerald-700' : 'text-red-700'}`}>
                      {m.qty_perubahan}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700">
                      {m.saldo_akhir}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      <div>{m.keterangan || '-'}</div>
                      <div className="font-mono mt-1">{m.referensi}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500">
                    Belum ada riwayat transaksi untuk barang ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
