"use client";

import React, { useMemo, useState } from "react";
import {
  Search, ChevronRight, ChevronLeft, PackageOpen, Layers,
  Boxes, Wallet, AlertTriangle, Archive, ArrowUpDown, ArrowUp, ArrowDown, Zap,
  ArrowDownToLine, ArrowUpFromLine, ClipboardList, ExternalLink,
} from "lucide-react";
import { InventoryItem } from "./types";

// Helper format Rupiah (aman dari hydration error)
const formatRupiah = (angka: number) => {
  return "Rp " + Math.round(angka).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Format ringkas buat KPI (Rp 128,4 jt / Rp 1,2 M)
const formatRupiahRingkas = (angka: number) => {
  if (angka >= 1_000_000_000) return "Rp " + (angka / 1_000_000_000).toFixed(1).replace(".", ",") + " M";
  if (angka >= 1_000_000) return "Rp " + (angka / 1_000_000).toFixed(1).replace(".", ",") + " jt";
  return formatRupiah(angka);
};

// Format qty pack-aware.
// - Kalau tidak punya satuan_besar (atau isi_per_satuan_besar <= 1): "551 Pcs"
// - Kalau habis dibagi: "226 Pack" (subteks kecil "= 226,000 Lembar")
// - Kalau ada sisa: "7 Pack + 500 Set" (subteks kecil "= 7,500 Set")
function formatQtyPack(qtyKecil: number, satuan: string, satuanBesar: string | null | undefined, isiPerBesar: number | null | undefined) {
  const isi = Number(isiPerBesar) || 1;
  if (!satuanBesar || isi <= 1) {
    return { utama: `${qtyKecil.toLocaleString("id-ID")} ${satuan}`, sub: null as string | null };
  }
  const besar = Math.floor(qtyKecil / isi);
  const sisa = qtyKecil - besar * isi;
  const sub = `= ${qtyKecil.toLocaleString("id-ID")} ${satuan}`;
  if (sisa === 0) return { utama: `${besar.toLocaleString("id-ID")} ${satuanBesar}`, sub };
  return { utama: `${besar.toLocaleString("id-ID")} ${satuanBesar} + ${sisa.toLocaleString("id-ID")} ${satuan}`, sub };
}

const formatTanggal = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

const umurHari = (iso: string | null) => {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
};

// 3 tingkat kondisi stok: KRITIS (<= minimum), MENIPIS (<= 1.5x minimum), AMAN
type Kondisi = "kritis" | "menipis" | "aman";
const getKondisi = (item: InventoryItem): Kondisi => {
  if (item.totalStok <= item.batas_minimum) return "kritis";
  if (item.totalStok <= item.batas_minimum * 1.5) return "menipis";
  return "aman";
};

const KONDISI_CONFIG: Record<Kondisi, { label: string; badge: string; dot: string; bar: string }> = {
  kritis: {
    label: "Kritis",
    badge: "bg-red-50 text-red-600 border-red-100",
    dot: "bg-red-500 animate-pulse",
    bar: "bg-red-500",
  },
  menipis: {
    label: "Menipis",
    badge: "bg-amber-50 text-amber-600 border-amber-100",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
  },
  aman: {
    label: "Aman",
    badge: "bg-emerald-50 text-emerald-600 border-emerald-100",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
};

type SortKey = "nama" | "totalStok" | "totalNilai" | null;

export default function InventoryClient({ initialData }: { initialData: InventoryItem[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKondisi, setFilterKondisi] = useState<Kondisi | "all">("all");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // KPI agregat — dihitung dari SEMUA data, bukan hasil filter
  const kpi = useMemo(() => {
    const totalNilai = initialData.reduce((s, i) => s + i.totalNilai, 0);
    const totalBatch = initialData.reduce((s, i) => s + i.batch_Barang.length, 0);
    const perluRestock = initialData.filter((i) => getKondisi(i) !== "aman").length;
    return { totalSku: initialData.length, totalNilai, totalBatch, perluRestock };
  }, [initialData]);

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let rows = initialData.filter(
      (item) =>
        (item.nama.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.kategori || "").toLowerCase().includes(q)) &&
        (filterKondisi === "all" || getKondisi(item) === filterKondisi)
    );
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const dir = sortAsc ? 1 : -1;
        if (sortKey === "nama") return a.nama.localeCompare(b.nama) * dir;
        return (a[sortKey] - b[sortKey]) * dir;
      });
    }
    return rows;
  }, [initialData, searchQuery, filterKondisi, sortKey, sortAsc]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));

  const toggleRow = (id: string) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "nama"); // nama default A-Z, angka default terbesar dulu
    }
    setCurrentPage(1);
  };

  const setFilter = (k: Kondisi | "all") => {
    setFilterKondisi(k);
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown size={13} className="text-slate-300" />;
    return sortAsc ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />;
  };

  const filterChips: { key: Kondisi | "all"; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "kritis", label: "Kritis" },
    { key: "menipis", label: "Menipis" },
    { key: "aman", label: "Aman" },
  ];

  return (
    <div className="space-y-6">
      {/* ===== KPI STRIP ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Boxes size={20} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total SKU</p>
            <p className="text-2xl font-black text-slate-800">{kpi.totalSku}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <Wallet size={20} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nilai Aset (FIFO)</p>
            <p className="text-2xl font-black text-slate-800 truncate" title={formatRupiah(kpi.totalNilai)}>
              {formatRupiahRingkas(kpi.totalNilai)}
            </p>
          </div>
        </div>
        <button
          onClick={() => setFilter(filterKondisi === "kritis" ? "all" : "kritis")}
          className={`glass-panel rounded-2xl p-5 flex items-center gap-4 text-left transition-all hover:shadow-md ${
            filterKondisi === "kritis" ? "ring-2 ring-red-400/60" : ""
          }`}
          title="Klik untuk filter barang kritis"
        >
          <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Perlu Restock</p>
            <p className={`text-2xl font-black ${kpi.perluRestock > 0 ? "text-red-600" : "text-slate-800"}`}>
              {kpi.perluRestock}
            </p>
          </div>
        </button>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Archive size={20} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Batch Aktif</p>
            <p className="text-2xl font-black text-slate-800">{kpi.totalBatch}</p>
          </div>
        </div>
      </div>

      {/* ===== PANEL TABEL ===== */}
      <div className="glass-panel rounded-2xl flex flex-col overflow-hidden">
        {/* Header: judul + search + filter chips */}
        <div className="p-5 border-b border-slate-200/60 bg-white/40 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 shrink-0">
            <Layers size={20} className="text-blue-600" /> Rincian Barang
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
              {filterChips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => setFilter(chip.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterKondisi === chip.key
                      ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                className="block w-full pl-11 pr-4 py-2.5 bg-white/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all shadow-sm placeholder:text-slate-400 font-medium text-slate-700"
                placeholder="Cari SKU, nama, kategori..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        </div>

        {/* Tabel */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">
                  <button onClick={() => toggleSort("nama")} className="flex items-center gap-1.5 uppercase hover:text-slate-700 transition-colors">
                    Barang <SortIcon column="nama" />
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button onClick={() => toggleSort("totalStok")} className="flex items-center gap-1.5 uppercase hover:text-slate-700 transition-colors ml-auto">
                    Stok <SortIcon column="totalStok" />
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button onClick={() => toggleSort("totalNilai")} className="flex items-center gap-1.5 uppercase hover:text-slate-700 transition-colors ml-auto">
                    Total Aset (FIFO) <SortIcon column="totalNilai" />
                  </button>
                </th>
                <th className="px-6 py-4 text-center">Kondisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <PackageOpen className="h-12 w-12 text-slate-300 mb-3" />
                      <p className="font-bold text-slate-600 text-base">Barang Tidak Ditemukan</p>
                      <p className="text-xs mt-1">Ubah kata kunci pencarian atau filter kondisi.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item) => {
                  const kondisi = getKondisi(item);
                  const cfg = KONDISI_CONFIG[kondisi];
                  // Bar kesehatan stok: penuh saat stok = 2x batas minimum
                  const barPct = item.batas_minimum > 0
                    ? Math.min(100, Math.round((item.totalStok / (item.batas_minimum * 2)) * 100))
                    : 100;
                  const fmtStok = formatQtyPack(item.totalStok, item.satuan, item.satuan_besar, item.isi_per_satuan_besar);
                  return (
                    <React.Fragment key={item.id}>
                      {/* BARIS UTAMA */}
                      <tr
                        className={`transition-all duration-300 cursor-pointer ${
                          expandedRows[item.id] ? "bg-blue-50/40 shadow-sm" : "hover:bg-white/60 hover:shadow-sm"
                        }`}
                        onClick={() => toggleRow(item.id)}
                      >
                        <td className="px-6 py-4 text-slate-400">
                          <div className={`transition-transform duration-300 ${expandedRows[item.id] ? "rotate-90 text-blue-600" : ""}`}>
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800 text-base leading-tight">{item.nama}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] border border-slate-200">
                              {item.sku}
                            </span>
                            {item.kategori && (
                              <span className="text-[11px] font-semibold text-slate-400">{item.kategori}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-black text-lg text-slate-700">{fmtStok.utama}</span>
                          {fmtStok.sub && <div className="text-[10px] text-slate-400 mt-0.5">{fmtStok.sub}</div>}
                          <div className="w-28 ml-auto mt-1.5">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${cfg.bar} transition-all duration-500`} style={{ width: `${barPct}%` }} />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 text-right">min. {item.batas_minimum} {item.satuan}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatRupiah(item.totalNilai)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span> {cfg.label}
                          </span>
                        </td>
                      </tr>

                      {/* BARIS EXPANDED: ANTREAN FIFO */}
                      {expandedRows[item.id] && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={5} className="p-0">
                            <div className="px-6 py-4 pl-16">
                              <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
                                <Zap size={13} className="text-blue-500" />
                                Antrean FIFO — batch teratas dipotong duluan saat FPKB diproses
                              </p>
                              {item.batch_Barang.length === 0 ? (
                                <div className="bg-white rounded-xl border border-slate-200 px-4 py-6 text-center text-slate-400 text-xs italic">
                                  Tidak ada batch tersedia di rak saat ini.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {item.batch_Barang.map((batch, idx) => {
                                    const umur = umurHari(batch.tanggal_masuk);
                                    const pertama = idx === 0;
                                    const fmtBatch = formatQtyPack(batch.qty_sisa, item.satuan, item.satuan_besar, item.isi_per_satuan_besar);
                                    return (
                                      <div
                                        key={batch.id}
                                        className={`bg-white rounded-xl border shadow-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 relative overflow-hidden ${
                                          pertama ? "border-blue-200" : "border-slate-200"
                                        }`}
                                      >
                                        {pertama && (
                                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-600"></div>
                                        )}
                                        <span className={`font-mono text-xs font-bold w-6 shrink-0 ${pertama ? "text-blue-600 pl-1.5" : "text-slate-400"}`}>
                                          #{idx + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-slate-700 text-sm">
                                              Rak {batch.lokasi?.rak ?? "—"}
                                            </span>
                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
                                              Lorong {batch.lokasi?.lorong ?? "—"}
                                            </span>
                                            {pertama && (
                                              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                                                Keluar berikutnya
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[11px] text-slate-400 mt-0.5">
                                            Masuk {formatTanggal(batch.tanggal_masuk)}
                                            {umur !== null && <> · umur <span className="font-semibold text-slate-500">{umur} hari</span></>}
                                          </p>
                                        </div>
                                        <div className="text-left sm:text-right shrink-0">
                                          <p className="font-black text-slate-700 text-sm">
                                            {fmtBatch.utama}
                                          </p>
                                          {fmtBatch.sub && <p className="text-[10px] text-slate-400">{fmtBatch.sub}</p>}
                                          <p className="text-[11px] text-slate-400 font-mono">
                                            @ {formatRupiah(batch.harga_satuan)} = <span className="font-bold text-blue-600">{formatRupiah(batch.qty_sisa * batch.harga_satuan)}</span>
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* MINI-HISTORY: 3 mutasi terakhir */}
                              <div className="mt-5 pt-4 border-t border-slate-200/60">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                                    <ClipboardList size={13} className="text-indigo-500" />
                                    3 Mutasi Terakhir
                                  </p>
                                  <a
                                    href={`/master/detail/${item.id}`}
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Lihat semua <ExternalLink size={11} />
                                  </a>
                                </div>

                                {item.recentMutasi.length === 0 ? (
                                  <div className="bg-white rounded-xl border border-slate-200 px-4 py-4 text-center text-slate-400 text-xs italic">
                                    Belum ada mutasi tercatat.
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {item.recentMutasi.map((m) => {
                                      const masuk = m.qty > 0;
                                      const cfg = masuk
                                        ? { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-600", ikon: ArrowDownToLine, label: "MASUK" }
                                        : { bg: "bg-red-50", border: "border-red-100", text: "text-red-600", ikon: ArrowUpFromLine, label: "KELUAR" };
                                      const Icon = cfg.ikon;
                                      const qtyAbs = Math.abs(m.qty);
                                      const f = formatQtyPack(qtyAbs, item.satuan, item.satuan_besar, item.isi_per_satuan_besar);
                                      return (
                                        <div key={m.id} className={`bg-white rounded-xl border ${cfg.border} shadow-sm flex items-center gap-3 px-3 py-2.5`}>
                                          <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                                            <Icon size={14} className={cfg.text} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                                                {cfg.label}
                                              </span>
                                              <span className="text-sm font-bold text-slate-700">{masuk ? "+" : "−"} {f.utama}</span>
                                              {m.referensi && (
                                                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                  {m.referensi}
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                              {formatTanggal(m.tanggal)}
                                              {m.keterangan && <> · {m.keterangan}</>}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
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

        {/* Footer pagination */}
        {filteredData.length > 0 && (
          <div className="p-4 border-t border-slate-200/60 bg-white/40 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-slate-500 font-medium">
              Menampilkan <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> -{" "}
              <span className="font-bold text-slate-800">{Math.min(indexOfLastItem, filteredData.length)}</span> dari{" "}
              <span className="font-bold text-slate-800">{filteredData.length}</span> barang
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-sm"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="px-4 py-2 rounded-xl bg-blue-50/50 text-blue-700 font-bold border border-blue-100/50 text-sm shadow-inner">
                Hal {currentPage} / {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-sm"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
