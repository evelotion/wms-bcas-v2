"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getMasterBarang, createMasterBarang, updateMasterBarang } from "./actions";
import {
  Plus, Search, Package, ServerCrash, ChevronLeft, ChevronRight, X, Printer,
  CreditCard as Edit, Boxes, Wallet, Layers, AlertTriangle, Info, Eye,
} from "lucide-react";
import DialogImport from "./DialogImport";
import Link from "next/link";

export default function MasterBarangPage() {
  const [items, setItems] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getMasterBarang();
    setItems(data);
    setIsLoading(false);
  };

  // === KPI ===
  const kpi = useMemo(() => {
    const totalSku = items.length;
    const denganKodeGl = items.filter((i) => i.kode_gl).length;
    const kategoriUnik = new Set(items.map((i) => i.kategori).filter(Boolean)).size;
    const perluSetupHarga = 0; // TODO: hubungkan ke SKU harga 0 saat data tersedia
    return { totalSku, denganKodeGl, kategoriUnik, perluSetupHarga };
  }, [items]);

  // === SEARCH & PAGINATION ===
  const filteredItems = items.filter(
    (item) =>
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nama.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));

  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  const handleOpenModal = (item: any | null = null) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    let res;
    if (editingItem) {
      res = await updateMasterBarang(editingItem.id, formData);
    } else {
      res = await createMasterBarang(formData);
    }

    if (res.success) {
      alert(editingItem ? "Barang berhasil diupdate!" : "Barang baru berhasil ditambahkan!");
      setIsModalOpen(false);
      setEditingItem(null);
      fetchData();
    } else {
      alert("Gagal: " + (res.error || "Unknown error"));
    }
    setIsSubmitting(false);
  };

  const handlePrintBarcode = (item: any) => {
    const printUrl = `/master/cetak-barcode/${item.id}?nama=${encodeURIComponent(item.nama)}&sku=${encodeURIComponent(item.sku)}`;
    window.open(printUrl, '_blank');
  };

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
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU dengan Kode GL</p>
            <p className="text-2xl font-black text-slate-800">{kpi.denganKodeGl}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Layers size={20} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kategori Unik</p>
            <p className="text-2xl font-black text-slate-800">{kpi.kategoriUnik}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Perlu Setup Harga</p>
            <p className="text-2xl font-black text-slate-800">{kpi.perluSetupHarga}</p>
          </div>
        </div>
      </div>

      {/* ===== PANEL TABEL ===== */}
      <div className="glass-panel rounded-2xl flex flex-col overflow-hidden">
        {/* Header: judul + search + aksi */}
        <div className="p-5 border-b border-slate-200/60 bg-white/40 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 shrink-0">
            <Package size={20} className="text-blue-600" /> Master Barang
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                className="block w-full pl-11 pr-4 py-2.5 bg-white/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all shadow-sm placeholder:text-slate-400 font-medium text-slate-700"
                placeholder="Cari SKU atau nama barang..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <DialogImport onRefresh={fetchData} />
              <button
                onClick={() => handleOpenModal()}
                className="bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/30 text-sm"
              >
                <Plus size={18} /> Tambah Barang
              </button>
            </div>
          </div>
        </div>

        {/* Tabel */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">SKU / Kode GL</th>
                <th className="px-6 py-4">Nama Barang</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Satuan</th>
                <th className="px-6 py-4 text-center">Batas Min.</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">Memuat data...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <ServerCrash className="h-12 w-12 text-slate-300 mb-3" />
                      <p className="font-bold text-slate-600 text-base">Belum Ada Data Barang</p>
                      <p className="text-xs mt-1">Klik &quot;Tambah Barang&quot; atau import Excel untuk mulai.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item) => (
                  <tr key={item.id} className="hover:bg-white/60 hover:shadow-sm transition-all">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] border border-slate-200">
                        {item.sku}
                      </span>
                      <div className="mt-1.5">
                        {item.kode_gl ? (
                          <span
                            className="inline-flex items-center gap-1 font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md text-[11px]"
                            title={item.keterangan_gl || "Kode GL"}
                          >
                            <Info size={10} /> {item.kode_gl}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[11px] italic">Belum ada GL</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">{item.nama}</td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-semibold border border-slate-200">
                        {item.kategori}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {item.satuan}
                      {item.satuan_besar && (
                        <span className="block text-[11px] text-slate-400">
                          {item.satuan_besar} (isi {item.isi_per_satuan_besar})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700">{item.batas_minimum}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/master/detail/${item.id}`}
                          className="p-2 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg transition-colors"
                          title="Detail Barang"
                        >
                          <Eye size={16} />
                        </Link>
                        <button onClick={() => handlePrintBarcode(item)} className="p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-colors" title="Cetak Barcode">
                          <Printer size={16} />
                        </button>
                        <button onClick={() => handleOpenModal(item)} className="p-2 text-slate-500 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors" title="Edit Barang">
                          <Edit size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer pagination */}
        {!isLoading && filteredItems.length > 0 && (
          <div className="p-4 border-t border-slate-200/60 bg-white/40 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-slate-500 font-medium">
              Menampilkan <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> -{" "}
              <span className="font-bold text-slate-800">{Math.min(indexOfLastItem, filteredItems.length)}</span> dari{" "}
              <span className="font-bold text-slate-800">{filteredItems.length}</span> barang
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-sm"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="px-4 py-2 rounded-xl bg-blue-50/50 text-blue-700 font-bold border border-blue-100/50 text-sm shadow-inner">
                Hal {currentPage} / {totalPages}
              </div>
              <button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-sm"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal tambah/edit */}
      {isModalOpen && isMounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/30 backdrop-blur-md">
          <div className="glass-panel rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-modal-in">
            <div className="p-6 border-b border-slate-200/60 flex justify-between items-center bg-white/40">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Package className="text-blue-600" size={20} /> {editingItem ? 'Edit Barang' : 'Tambah Barang Baru'}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setEditingItem(null); }} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-5">

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">SKU / Kode Barang</label>
                  <input name="sku" type="text" required defaultValue={editingItem?.sku || ""} placeholder="Contoh: ATK-001" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Nama Barang</label>
                  <input name="nama" type="text" required defaultValue={editingItem?.nama || ""} placeholder="Contoh: Kertas HVS A4" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Kategori</label>
                    <input name="kategori" type="text" required defaultValue={editingItem?.kategori || ""} placeholder="Contoh: ATK" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Satuan</label>
                    <input name="satuan" type="text" required defaultValue={editingItem?.satuan || ""} placeholder="Contoh: Rim" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                  </div>
                </div>

                <details className="group bg-slate-50/70 border border-slate-200 rounded-xl" open={!!(editingItem?.kode_gl || editingItem?.keterangan_gl)}>
                  <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                    Kode GL (opsional)
                    <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <div className="grid grid-cols-2 gap-4 px-4 pb-4 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Kode GL</label>
                      <input name="kode_gl" type="text" pattern="[0-9]*" defaultValue={editingItem?.kode_gl || ""} placeholder="Contoh: 1442301" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Keterangan GL</label>
                      <input name="keterangan_gl" type="text" defaultValue={editingItem?.keterangan_gl || ""} placeholder="Contoh: BARANG CETAKAN" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                    </div>
                  </div>
                </details>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Satuan Besar (Opsional)</label>
                    <input name="satuan_besar" type="text" defaultValue={editingItem?.satuan_besar || ""} placeholder="Contoh: Dus" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Isi per Satuan Besar</label>
                    <input name="isi_per_satuan_besar" type="number" min="1" defaultValue={editingItem?.isi_per_satuan_besar || "1"} className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Minimum Order (Satuan Besar, Opsional)</label>
                  <input name="minimum_order_besar" type="number" min="0" defaultValue={editingItem?.minimum_order_besar ?? ""} className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Batas Minimum Stok</label>
                  <input name="batas_minimum" type="number" min="0" required defaultValue={editingItem?.batas_minimum || "0"} className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => { setIsModalOpen(false); setEditingItem(null); }} className="flex-1 px-4 py-3 border border-slate-200 bg-white/70 text-slate-700 rounded-xl font-bold hover:bg-white transition-colors">
                    Batal
                  </button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-bold transition-all disabled:opacity-70 shadow-lg shadow-blue-600/30">
                    {isSubmitting ? "Menyimpan..." : (editingItem ? "Update Barang" : "Simpan Barang")}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
