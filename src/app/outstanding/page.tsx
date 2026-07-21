"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getOutstandingList, tutupOutstanding, prosesUlangOutstanding } from "./actions";
import { getFpkbAlerts } from "@/app/actions";
import { getSession } from "@/app/login/actions";
import {
  Archive, PackageCheck, Clock, AlertTriangle, RefreshCw, XCircle, Wallet, CheckCircle2,
} from "lucide-react";

type FilterOutstanding = "semua" | "siap" | "menunggu" | "bisa_ditutup";

export default function OutstandingPage() {
  const [outstandingList, setOutstandingList] = useState<any[]>([]);
  const [siapIdSet, setSiapIdSet] = useState<Set<string>>(new Set());
  const [siapCount, setSiapCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOutstanding>("semua");

  useEffect(() => {
    fetchData();
    getSession().then((session) => {
      if (session) setUserRole(session.role);
    });
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [data, alerts] = await Promise.all([
      getOutstandingList(),
      getFpkbAlerts(),
    ]);
    setOutstandingList(data || []);
    setSiapIdSet(new Set((alerts.outstandingBisaDiproses || []).map((o: any) => o.id)));
    setSiapCount(alerts.outstandingBisaDiprosesCount || 0);
    setIsLoading(false);
  };

  // ===== KPI =====
  const kpi = useMemo(() => {
    const totalAktif = outstandingList.length;
    const nilaiOutstanding = 0; // TODO: hubungkan ke harga per item saat data tersedia
    let tertuaHari = 0;
    if (outstandingList.length > 0) {
      const tertua = outstandingList.reduce((min, o) =>
        new Date(o.createdAt) < new Date(min.createdAt) ? o : min
      );
      tertuaHari = Math.max(0, Math.round((Date.now() - new Date(tertua.createdAt).getTime()) / 86_400_000));
    }
    return { totalAktif, stokCukup: siapCount, nilaiOutstanding, tertuaHari };
  }, [outstandingList, siapCount]);

  const filteredList = useMemo(() => {
    return outstandingList.filter((item) => {
      const stokSiap = siapIdSet.has(item.id);
      if (filter === "siap") return stokSiap;
      if (filter === "menunggu") return !stokSiap;
      if (filter === "bisa_ditutup") return !item.fpkbLanjutanId;
      return true;
    });
  }, [outstandingList, siapIdSet, filter]);

  const toggleFilter = (f: FilterOutstanding) => setFilter((prev) => (prev === f ? "semua" : f));

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

  const filterChips: { key: FilterOutstanding; label: string }[] = [
    { key: "semua", label: "Semua" },
    { key: "siap", label: "Siap Diproses Ulang" },
    { key: "menunggu", label: "Menunggu Restock" },
    ...(canAct ? [{ key: "bisa_ditutup" as FilterOutstanding, label: "Bisa Ditutup" }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* ===== KPI STRIP ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Outstanding Aktif</p>
            <p className="text-2xl font-black text-slate-800">{kpi.totalAktif}</p>
          </div>
        </div>
        <button
          onClick={() => toggleFilter("siap")}
          className={`glass-panel rounded-2xl p-5 flex items-center gap-4 text-left transition-all hover:shadow-md ${
            filter === "siap" ? "ring-2 ring-emerald-400/60" : ""
          }`}
          title="Klik untuk filter barang yang siap diproses ulang"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stok Sudah Cukup</p>
            <p className={`text-2xl font-black ${kpi.stokCukup > 0 ? "text-emerald-600" : "text-slate-800"}`}>
              {kpi.stokCukup}
            </p>
          </div>
        </button>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
            <Wallet size={20} className="text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nilai Outstanding</p>
            <p className="text-2xl font-black text-slate-800">{kpi.nilaiOutstanding}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <Clock size={20} className="text-slate-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tertua Sejak</p>
            <p className="text-2xl font-black text-slate-800">{kpi.tertuaHari} <span className="text-sm font-bold text-slate-400">hari</span></p>
          </div>
        </div>
      </div>

      {/* ===== PANEL LIST ===== */}
      <div className="glass-panel rounded-2xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200/60 bg-white/40 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 shrink-0">
            <Archive size={20} className="text-orange-600" /> Outstanding Barang
          </h2>
          <div className="flex gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 overflow-x-auto">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  filter === chip.key
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Memuat data outstanding...</div>
          ) : filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <PackageCheck className="h-12 w-12 text-emerald-400 mb-3" />
              <p className="font-bold text-slate-600 text-base">
                {outstandingList.length === 0 ? "🎉 Tidak ada outstanding. Semua permintaan sudah terpenuhi." : "Tidak ada item yang cocok dengan filter ini."}
              </p>
              <p className="text-xs mt-1 text-slate-400">
                {outstandingList.length === 0 ? "Gudang bersih, tidak ada tunggakan barang ke cabang." : "Coba ubah filter di atas."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredList.map((item) => {
                const stokSiap = siapIdSet.has(item.id);
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white/70 p-4 flex flex-col gap-3 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm">FPP #{item.header.nomor_fpp}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {item.header.cabang} · {item.header.wilayah === "JABODETABEK" ? "JABODETABEK" : "NON-JABODETABEK"}
                        </p>
                      </div>
                      {stokSiap ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-100 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Stok Siap ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-slate-100 text-slate-500 border-slate-200 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Menunggu Restock
                        </span>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <p className="font-bold text-slate-800 text-sm leading-tight">{item.barang.nama}</p>
                      <span className="font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] border border-slate-200 inline-block mt-1">
                        {item.barang.sku}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Sisa Hutang</span>
                      <span className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg font-bold text-sm flex items-center gap-1">
                        <AlertTriangle size={12} /> {item.qty_sisa} {item.barang.satuan}
                      </span>
                    </div>

                    {item.fpkbAsal && (
                      <p className="text-[11px] text-slate-400">Dari FPKB #{item.fpkbAsal.nomor_fpkb}</p>
                    )}
                    {item.fpkbLanjutan && (
                      <p className="text-[11px] text-blue-500 flex items-center gap-1">
                        <RefreshCw size={11} /> Sudah diterbitkan FPKB #{item.fpkbLanjutan.nomor_fpkb}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock size={11} /> {new Date(item.createdAt).toLocaleDateString("id-ID")}
                    </p>

                    {canAct && (
                      <div className="pt-2 border-t border-slate-100 flex gap-2">
                        {item.fpkbLanjutanId ? (
                          <span className="text-xs text-slate-400 italic w-full text-center py-2">Sudah diproses ulang</span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleProsesUlang(item)}
                              disabled={processingId === item.id}
                              className="flex-1 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-1"
                            >
                              <RefreshCw size={14} /> Proses Ulang
                            </button>
                            <button
                              onClick={() => handleTutup(item)}
                              disabled={processingId === item.id}
                              className="flex-1 border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                            >
                              <XCircle size={14} /> Tutup
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
