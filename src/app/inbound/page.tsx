"use client";

import { useEffect, useMemo, useState } from "react";
import { getInboundFormData, createInbound, getRecentInbound } from "./actions";
import {
  PackagePlus, ArrowDownToLine, Save, Plus, X, ChevronLeft, ChevronRight, Search,
  ArrowDownRight, Wallet, Archive, TrendingUp, MapPin,
} from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

const formatRupiah = (angka: number) => {
  return "Rp " + Math.round(angka).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const formatRupiahRingkas = (angka: number) => {
  if (angka >= 1_000_000_000) return "Rp " + (angka / 1_000_000_000).toFixed(1).replace(".", ",") + " M";
  if (angka >= 1_000_000) return "Rp " + (angka / 1_000_000).toFixed(1).replace(".", ",") + " jt";
  return formatRupiah(angka);
};

type FilterBulan = "bulan_ini" | "3_bulan" | "semua";

export default function InboundPage() {
  const [formData, setFormData] = useState({ barang: [], lokasi: [] });
  const [recentInbounds, setRecentInbounds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterBulan, setFilterBulan] = useState<FilterBulan>("bulan_ini");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [selectedBarangId, setSelectedBarangId] = useState("");
  const [selectedLokasiId, setSelectedLokasiId] = useState("");
  const [qtyInput, setQtyInput] = useState("");
  const [hargaInput, setHargaInput] = useState("0");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [formOptions, history] = await Promise.all([
      getInboundFormData(),
      getRecentInbound()
    ]);
    setFormData(formOptions as any);
    setRecentInbounds(history);
    setIsLoading(false);
  };

  // ===== KPI (Bulan Ini) =====
  const kpi = useMemo(() => {
    const now = new Date();
    const bulanIni = recentInbounds.filter((i) => {
      const d = new Date(i.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const nilaiBulanIni = bulanIni.reduce((s, i) => s + i.qty_perubahan * (i.batch?.harga_satuan || 0), 0);
    const batchAktif = recentInbounds.filter((i) => i.batch?.status === "AVAILABLE").length;
    const rataRataHarga = bulanIni.length > 0
      ? bulanIni.reduce((s, i) => s + (i.batch?.harga_satuan || 0), 0) / bulanIni.length
      : 0;
    return { totalBulanIni: bulanIni.length, nilaiBulanIni, batchAktif, rataRataHarga };
  }, [recentInbounds]);

  // ===== FILTER & SEARCH =====
  const filteredInbounds = useMemo(() => {
    const now = new Date();
    const q = searchQuery.toLowerCase();
    return recentInbounds.filter((item) => {
      const d = new Date(item.createdAt);
      let inRange = true;
      if (filterBulan === "bulan_ini") {
        inRange = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (filterBulan === "3_bulan") {
        const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        inRange = d >= cutoff;
      }
      const matchSearch =
        !q ||
        item.batch?.barang?.nama?.toLowerCase().includes(q) ||
        item.batch?.barang?.sku?.toLowerCase().includes(q) ||
        item.referensi?.toLowerCase().includes(q) ||
        item.keterangan?.toLowerCase().includes(q);
      return inRange && matchSearch;
    });
  }, [recentInbounds, filterBulan, searchQuery]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredInbounds.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.max(1, Math.ceil(filteredInbounds.length / itemsPerPage));

  const setFilter = (f: FilterBulan) => { setFilterBulan(f); setCurrentPage(1); };

  const selectedBarang = (formData as any).barang?.find((b: any) => b.id === selectedBarangId);
  const previewQty = parseInt(qtyInput) || 0;
  const previewHarga = parseFloat(hargaInput) || 0;

  const resetForm = () => {
    setSelectedBarangId("");
    setSelectedLokasiId("");
    setQtyInput("");
    setHargaInput("0");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const data = new FormData(e.currentTarget);
    const res = await createInbound(data);

    if (res.success) {
      let alertMsg = "✅ Barang berhasil masuk gudang!";
      if (res.triggeredOutstandings && res.triggeredOutstandings.length > 0) {
         alertMsg += "\n\n⚠️ PERHATIAN! Barang ini sedang ditunggu untuk segera dikirim:\n" + res.triggeredOutstandings.join("\n");
      }
      alert(alertMsg);
      e.currentTarget.reset();
      resetForm();
      setIsModalOpen(false);
      fetchData();
    } else {
      alert("❌ " + res.error);
    }
    setIsSubmitting(false);
  };

  const filterChips: { key: FilterBulan; label: string }[] = [
    { key: "bulan_ini", label: "Bulan Ini" },
    { key: "3_bulan", label: "3 Bulan" },
    { key: "semua", label: "Semua" },
  ];

  return (
    <div className="space-y-6">
      {/* ===== KPI STRIP ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <ArrowDownRight size={20} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Inbound Bulan Ini</p>
            <p className="text-2xl font-black text-slate-800">{kpi.totalBulanIni}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <Wallet size={20} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nilai Inbound Bulan Ini</p>
            <p className="text-2xl font-black text-slate-800 truncate" title={formatRupiah(kpi.nilaiBulanIni)}>
              {formatRupiahRingkas(kpi.nilaiBulanIni)}
            </p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Archive size={20} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Batch Aktif Total</p>
            <p className="text-2xl font-black text-slate-800">{kpi.batchAktif}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <TrendingUp size={20} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rata-rata Harga Bulan Ini</p>
            <p className="text-2xl font-black text-slate-800 truncate" title={formatRupiah(kpi.rataRataHarga)}>
              {formatRupiahRingkas(kpi.rataRataHarga)}
            </p>
          </div>
        </div>
      </div>

      {/* ===== PANEL TABEL ===== */}
      <div className="glass-panel rounded-2xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200/60 bg-white/40 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 shrink-0">
            <ArrowDownToLine size={20} className="text-emerald-600" /> Riwayat Inbound
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
              {filterChips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => setFilter(chip.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterBulan === chip.key
                      ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                className="block w-full pl-11 pr-4 py-2.5 bg-white/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all shadow-sm placeholder:text-slate-400 font-medium text-slate-700"
                placeholder="Cari barang, referensi..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30 text-sm shrink-0"
            >
              <Plus size={18} /> Tambah Inbound
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Barang</th>
                <th className="px-6 py-4 text-right">Qty</th>
                <th className="px-6 py-4 text-right">Harga Satuan</th>
                <th className="px-6 py-4 text-right">Subtotal</th>
                <th className="px-6 py-4">Rak</th>
                <th className="px-6 py-4">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">Memuat riwayat...</td></tr>
              ) : filteredInbounds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <PackagePlus className="h-12 w-12 text-slate-300 mb-3" />
                      <p className="font-bold text-slate-600 text-base">Belum Ada Inbound</p>
                      <p className="text-xs mt-1">Klik &quot;Tambah Inbound&quot; untuk mulai.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item) => {
                  const subtotal = item.qty_perubahan * (item.batch?.harga_satuan || 0);
                  return (
                    <tr key={item.id} className="hover:bg-white/60 hover:shadow-sm transition-all">
                      <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString('id-ID', { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{item.batch?.barang?.nama}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] border border-slate-200">
                            {item.batch?.barang?.sku}
                          </span>
                          {item.batch?.supplier && (
                            <span className="text-[11px] text-slate-400">{item.batch.supplier}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-black text-slate-700">+{item.qty_perubahan}</span>
                        <span className="text-slate-400 font-medium text-xs ml-1">{item.batch?.barang?.satuan}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600 font-medium">{formatRupiah(item.batch?.harga_satuan || 0)}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatRupiah(subtotal)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md font-medium text-slate-600 text-xs">
                          <MapPin size={11} /> {item.batch?.lokasi?.lorong}-{item.batch?.lokasi?.rak}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-[180px] truncate" title={item.keterangan || ""}>
                        {item.keterangan || <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredInbounds.length > 0 && (
          <div className="p-4 border-t border-slate-200/60 bg-white/40 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-slate-500 font-medium">
              Menampilkan <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> -{" "}
              <span className="font-bold text-slate-800">{Math.min(indexOfLastItem, filteredInbounds.length)}</span> dari{" "}
              <span className="font-bold text-slate-800">{filteredInbounds.length}</span> mutasi
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

      {/* ===== MODAL INPUT INBOUND ===== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="glass-panel rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-200/60 flex justify-between items-center bg-white/40">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ArrowDownToLine size={20} className="text-emerald-600"/> Tambah Inbound Baru
              </h2>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* KOLOM KIRI: FORM FIELDS */}
                <div className="lg:col-span-2 space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Barang</label>
                    <SearchableSelect
                      name="barangId"
                      options={(formData as any).barang?.map((b:any) => ({id: b.id, label: b.nama, sku: b.sku})) || []}
                      value={selectedBarangId}
                      onChange={setSelectedBarangId}
                      placeholder="Ketik SKU atau Nama Barang..."
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Lokasi Rak</label>
                      <SearchableSelect
                        name="lokasiId"
                        options={(formData as any).lokasi?.map((l:any) => ({id: l.id, label: `Rak ${l.rak} (Lorong ${l.lorong})`, sku: l.gudang})) || []}
                        value={selectedLokasiId}
                        onChange={setSelectedLokasiId}
                        placeholder="Cari Lokasi Rak..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal Masuk</label>
                      <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500 font-medium">
                        Hari ini ({new Date().toLocaleDateString("id-ID")}) — otomatis
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Qty Masuk</label>
                      <input name="qty" type="number" min="1" required value={qtyInput} onChange={(e) => setQtyInput(e.target.value)} className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Harga Satuan (Rp)</label>
                      <input name="harga" type="number" min="0" required value={hargaInput} onChange={(e) => setHargaInput(e.target.value)} className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Nomor Surat/Referensi FPP</label>
                      <input name="referensi" type="text" required placeholder="Contoh: PO-2026-001" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Nama Supplier / Vendor</label>
                      <input name="supplier" type="text" placeholder="Opsional" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Nomorator Awal</label>
                      <input name="nomorator_awal" type="text" placeholder="Opsional, contoh: 001" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Nomorator Akhir</label>
                      <input name="nomorator_akhir" type="text" placeholder="Opsional, contoh: 100" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none text-sm transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Keterangan Tambahan</label>
                    <textarea name="keterangan" rows={2} className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none text-sm transition-all"></textarea>
                  </div>
                </div>

                {/* KOLOM KANAN: PREVIEW BATCH */}
                <div className="lg:col-span-1">
                  <div className="glass-panel rounded-2xl p-5 sticky top-4 space-y-4 bg-emerald-50/30">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                      <PackagePlus size={16} className="text-emerald-600" /> Preview Batch Baru
                    </h3>
                    {selectedBarang ? (
                      <div className="space-y-3">
                        <div>
                          <p className="font-bold text-slate-800 text-sm leading-tight">{selectedBarang.nama}</p>
                          <span className="font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md text-[11px] border border-slate-200 inline-block mt-1">
                            {selectedBarang.sku}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm border-t border-slate-200/60 pt-3">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Qty Masuk</span>
                            <span className="font-bold text-slate-800">{previewQty || 0} {selectedBarang.satuan}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Harga Satuan</span>
                            <span className="font-bold text-slate-800">{formatRupiah(previewHarga)}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-200/60 pt-2">
                            <span className="text-slate-500 font-semibold">Subtotal</span>
                            <span className="font-black text-emerald-600">{formatRupiah(previewQty * previewHarga)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Pilih barang untuk melihat preview batch.</p>
                    )}
                    <button type="submit" disabled={isSubmitting || !selectedBarangId || !selectedLokasiId} className="w-full bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-70">
                      <Save size={18} /> {isSubmitting ? "Memproses..." : "Simpan Inbound"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
