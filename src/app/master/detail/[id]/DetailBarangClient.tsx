"use client";

import { useEffect, useState } from "react";
import { getDetailBarangLengkap } from "./actions";
import {
  ArrowLeft, Printer, Boxes, Archive, Wallet, AlertTriangle, Info, Layers,
  History, ArrowDownToLine, ArrowUpRight, PackageOpen, Loader2, ServerCrash,
} from "lucide-react";
import Link from "next/link";

const formatRupiah = (angka: number) => {
  return "Rp " + Math.round(angka).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const formatTanggal = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

const umurHari = (iso: string | null) => {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
};

export default function DetailBarangClient({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setIsError(false);
      try {
        const result = await getDetailBarangLengkap(id);
        setData(result);
      } catch {
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="glass-panel rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="font-bold">Memuat Detail Barang...</p>
      </div>
    );
  }

  if (isError || !data?.barang) {
    return (
      <div className="glass-panel rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-red-500">
        <ServerCrash size={32} className="text-red-300" />
        <p className="font-bold">Barang tidak ditemukan!</p>
      </div>
    );
  }

  const { barang, totalStok, batches, mutasi } = data;
  const nilaiStokTotal = (batches || []).reduce(
    (s: number, b: any) => s + b.qty_sisa * b.harga_satuan,
    0
  );
  const printUrl = `/master/cetak-barcode/${id}?nama=${encodeURIComponent(barang.nama)}&sku=${encodeURIComponent(barang.sku)}`;

  return (
    <div className="w-full space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/master" className="p-2 bg-white rounded-xl shadow-sm text-slate-500 hover:text-blue-600 transition-colors shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-800 leading-tight">Detail & Kartu Stok</h1>
            <p className="text-sm text-slate-500 truncate">{barang.nama}</p>
          </div>
        </div>
        <Link
          href={printUrl}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors text-sm"
        >
          <Printer size={16} /> Cetak Barcode
        </Link>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
            totalStok <= barang.batas_minimum ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"
          }`}>
            <Boxes size={20} className={totalStok <= barang.batas_minimum ? "text-red-500" : "text-emerald-600"} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Stok</p>
            <p className={`text-2xl font-black ${totalStok <= barang.batas_minimum ? "text-red-600" : "text-emerald-600"}`}>
              {totalStok} <span className="text-sm text-slate-500 font-medium">{barang.satuan}</span>
            </p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Archive size={20} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Jumlah Batch Aktif</p>
            <p className="text-2xl font-black text-slate-800">{(batches || []).length}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <Wallet size={20} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nilai Stok Total</p>
            <p className="text-2xl font-black text-slate-800 truncate" title={formatRupiah(nilaiStokTotal)}>
              {formatRupiah(nilaiStokTotal)}
            </p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Batas Minimum</p>
            <p className="text-2xl font-black text-slate-800">
              {barang.batas_minimum} <span className="text-sm text-slate-500 font-medium">{barang.satuan}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Metadata Barang */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">SKU</p>
            <p className="font-bold text-slate-800">{barang.sku}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Kode GL</p>
            {barang.kode_gl ? (
              <span className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md text-xs">
                <Info size={11} /> {barang.kode_gl}
              </span>
            ) : (
              <p className="text-slate-300 text-xs italic">Belum ada GL</p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Kategori</p>
            <p className="font-bold text-slate-800">{barang.kategori}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Satuan</p>
            <p className="font-bold text-slate-800">
              {barang.satuan}
              {barang.satuan_besar && (
                <span className="text-slate-400 font-medium"> ({barang.satuan_besar}, isi {barang.isi_per_satuan_besar})</span>
              )}
            </p>
          </div>
          {barang.keterangan_gl && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Keterangan GL</p>
              <span className="inline-flex items-center font-mono font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md text-xs">
                {barang.keterangan_gl}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Panel Batch Aktif */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200/60 bg-white/40">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Layers size={18} className="text-blue-600" /> Batch Stok Aktif
          </h3>
        </div>
        <div className="p-4">
          {!batches || batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Archive size={40} className="text-slate-300 mb-2" />
              <p className="text-sm font-semibold">Belum ada batch aktif</p>
            </div>
          ) : (
            <div className="space-y-2">
              {batches.map((batch: any, idx: number) => {
                const umur = umurHari(batch.tanggal_masuk);
                return (
                  <div
                    key={batch.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3"
                  >
                    <span className="font-mono text-xs font-bold text-slate-400 shrink-0">
                      #{batch.id.slice(-8).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-700 text-sm">
                          Rak {batch.lokasi?.rak ?? "—"}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
                          Lorong {batch.lokasi?.lorong ?? "—"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Masuk {formatTanggal(batch.tanggal_masuk)}
                        {umur !== null && <> · umur <span className="font-semibold text-slate-500">{umur} hari</span></>}
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <p className="font-black text-slate-700 text-sm">
                        {batch.qty_sisa} <span className="font-medium text-xs text-slate-400">{barang.satuan}</span>
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        @ {formatRupiah(batch.harga_satuan)} = <span className="font-bold text-blue-600">{formatRupiah(batch.qty_sisa * batch.harga_satuan)}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Panel Log Mutasi */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200/60 bg-white/40">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <History size={18} className="text-blue-600" /> Log Keluar-Masuk Barang
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Tipe Transaksi</th>
                <th className="px-6 py-4 text-center">Perubahan</th>
                <th className="px-6 py-4 text-center">Saldo Akhir (Batch)</th>
                <th className="px-6 py-4">Keterangan / Referensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {mutasi && mutasi.length > 0 ? (
                mutasi.map((m: any) => (
                  <tr key={m.id} className="hover:bg-white/60 transition-colors">
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(m.createdAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {m.tipe_mutasi === "INBOUND" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-600 border-emerald-100">
                          <ArrowDownToLine size={13} /> Barang Masuk
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-red-50 text-red-600 border-red-100">
                          <ArrowUpRight size={13} /> Barang Keluar
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-4 text-center font-bold ${m.tipe_mutasi === "INBOUND" ? "text-emerald-700" : "text-red-700"}`}>
                      {m.qty_perubahan}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700">
                      {m.saldo_akhir}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      <div>{m.keterangan || "-"}</div>
                      <div className="font-mono mt-1">{m.referensi}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <PackageOpen className="h-12 w-12 text-slate-300 mb-3" />
                      <p className="font-bold text-slate-600 text-base">Belum ada riwayat transaksi</p>
                      <p className="text-xs mt-1">Transaksi keluar-masuk barang ini akan muncul di sini.</p>
                    </div>
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
