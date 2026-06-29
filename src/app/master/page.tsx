"use client";

import { useEffect, useState } from "react";
import { getMasterBarang, createMasterBarang, updateMasterBarang } from "./actions";
import { Plus, Search, Package, ServerCrash, ChevronLeft, ChevronRight, X, Printer, Database, Edit } from "lucide-react";
import DialogImport from "./DialogImport";

export default function MasterBarangPage() {
  const [items, setItems] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // === TAMBAHAN UNTUK PAGINATION ===
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getMasterBarang();
    setItems(data);
    setIsLoading(false);
  };

  // === LOGIC SEARCH & PAGINATION ===
  const filteredItems = items.filter(item => 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.nama.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

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
    const baseUrl = 'https://wms-bcas-v2.vercel.app';
    const printUrl = `${baseUrl}/master/cetak-barcode/${item.id}?nama=${encodeURIComponent(item.nama)}&sku=${encodeURIComponent(item.sku)}`;
    window.open(printUrl, '_blank');
  };

  return (
    <div className="w-full space-y-6 pb-10"> {/* FIX: w-full biar nggak sempit */}
      {/* Header Section */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-blue-500">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Master Barang</h1>
            <p className="text-sm text-slate-500">Manajemen daftar seluruh barang yang ada di gudang.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DialogImport onRefresh={fetchData} />
          <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-600/30"
          >
            <Plus size={18} /> Tambah Barang
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="glass-panel flex flex-col rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/40 flex justify-between items-center">
          <div className="relative w-full max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari SKU atau Nama Barang..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
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
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">Memuat data...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500 flex flex-col items-center justify-center">
                    <ServerCrash className="text-slate-300 mb-2" size={32} />
                    Belum ada data barang. Silakan tambah baru.
                  </td>
                </tr>
              ) : (
                currentItems.map((item) => (
                  <tr key={item.id} className="hover:bg-white/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-blue-700">{item.sku}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{item.nama}</td>
                    <td className="px-6 py-4"><span className="bg-slate-200/70 text-slate-700 px-2 py-1 rounded-md text-xs">{item.kategori}</span></td>
                    <td className="px-6 py-4">{item.satuan}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700">{item.batas_minimum}</td>
                    <td className="px-6 py-4 text-center flex items-center justify-center gap-1">
                      <button onClick={() => handleOpenModal(item)} className="p-2 text-slate-500 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors" title="Edit Barang">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handlePrintBarcode(item)} className="p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-colors" title="Cetak Barcode">
                        <Printer size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* === FOOTER PAGINATION === */}
        {!isLoading && filteredItems.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-slate-500">
              Menampilkan <span className="font-semibold text-slate-800">{indexOfFirstItem + 1}</span> sampai <span className="font-semibold text-slate-800">{Math.min(indexOfLastItem, filteredItems.length)}</span> dari <span className="font-semibold text-slate-800">{filteredItems.length}</span> barang
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={prevPage} 
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="px-4 py-2 rounded-lg bg-blue-100 text-blue-800 font-semibold border border-blue-200 text-sm">
                Halaman {currentPage} dari {totalPages}
              </div>

              <button 
                onClick={nextPage} 
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form FIX (Udah ada form input-nya) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Package className="text-blue-600"/> {editingItem ? 'Edit Barang' : 'Tambah Barang Baru'}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setEditingItem(null); }} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto no-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-5">
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SKU / Kode Barang</label>
                  <input name="sku" type="text" required defaultValue={editingItem?.sku || ""} placeholder="Contoh: ATK-001" className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nama Barang</label>
                  <input name="nama" type="text" required defaultValue={editingItem?.nama || ""} placeholder="Contoh: Kertas HVS A4" className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                    <input name="kategori" type="text" required defaultValue={editingItem?.kategori || ""} placeholder="Contoh: ATK" className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Satuan</label>
                    <input name="satuan" type="text" required defaultValue={editingItem?.satuan || ""} placeholder="Contoh: Rim" className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batas Minimum Stok</label>
                  <input name="batas_minimum" type="number" min="0" required defaultValue={editingItem?.batas_minimum || "0"} className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => { setIsModalOpen(false); setEditingItem(null); }} className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors">
                    Batal
                  </button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-70 shadow-lg shadow-blue-600/30">
                    {isSubmitting ? "Menyimpan..." : (editingItem ? "Update Barang" : "Simpan Barang")}
                  </button>
                </div>
                
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}