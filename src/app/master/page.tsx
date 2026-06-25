"use client";

import { useEffect, useState } from "react";
import { getMasterBarang, createMasterBarang } from "./actions";
import { Plus, Search, Package, ServerCrash, ChevronLeft, ChevronRight } from "lucide-react";

export default function MasterBarangPage() {
  const [items, setItems] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // === TAMBAHAN UNTUK PAGINATION ===
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Jumlah baris per halaman, bisa lo ganti misal 5 atau 20

  // Load Data awal
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getMasterBarang();
    setItems(data);
    setIsLoading(false);
  };

  // === LOGIC PAGINATION ===
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  // Ini yang bakal di-render di tabel, bukan semua 'items'
  const currentItems = items.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(items.length / itemsPerPage);

  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  // ==============================

  // Handle Submit Form
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const res = await createMasterBarang(formData);
    
    if (res.success) {
      setIsModalOpen(false);
      fetchData(); // Refresh table
    } else {
      alert(res.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="text-blue-600" /> Master Barang
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Database identitas barang logistik (tanpa kalkulasi stok).
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-600/30"
        >
          <Plus size={18} /> Tambah Barang
        </button>
      </div>

      {/* Table Section */}
      <div className="glass-panel rounded-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/40 flex justify-between items-center bg-white/20">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari SKU atau Nama Barang..." 
              className="w-full bg-white/50 border border-white/40 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Nama Barang</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Satuan</th>
                <th className="px-6 py-4 text-center">Batas Min.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">Memuat data...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 flex flex-col items-center justify-center">
                    <ServerCrash className="text-slate-300 mb-2" size={32} />
                    Belum ada data barang. Silakan tambah baru.
                  </td>
                </tr>
              ) : (
                // === PERHATIKAN: map-nya ganti pakai currentItems ===
                currentItems.map((item) => (
                  <tr key={item.id} className="hover:bg-white/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-blue-700 font-medium">{item.sku}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{item.nama}</td>
                    <td className="px-6 py-4"><span className="bg-slate-200/70 text-slate-700 px-2 py-1 rounded-md text-xs">{item.kategori}</span></td>
                    <td className="px-6 py-4">{item.satuan}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700">{item.batas_minimum}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* === FOOTER PAGINATION === */}
        {!isLoading && items.length > 0 && (
          <div className="p-4 border-t border-white/40 bg-white/20 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-slate-500">
              Menampilkan <span className="font-semibold text-slate-800">{indexOfFirstItem + 1}</span> sampai <span className="font-semibold text-slate-800">{Math.min(indexOfLastItem, items.length)}</span> dari <span className="font-semibold text-slate-800">{items.length}</span> barang
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={prevPage} 
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-white/40 bg-white/50 text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="px-4 py-2 rounded-lg bg-blue-50/50 text-blue-700 font-semibold border border-blue-100 text-sm">
                Halaman {currentPage} dari {totalPages}
              </div>

              <button 
                onClick={nextPage} 
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-white/40 bg-white/50 text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form Tambah Barang (Tetap Sama) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          {/* ... Isi modal persis sama kayak sebelumnya ... */}
        </div>
      )}
    </div>
  );
}