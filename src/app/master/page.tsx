"use client";

import { useEffect, useState } from "react";
import { getMasterBarang, createMasterBarang } from "./actions";
import { Plus, Search, Package, ServerCrash } from "lucide-react";

export default function MasterBarangPage() {
  const [items, setItems] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <div className="glass-panel rounded-2xl overflow-hidden">
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
                items.map((item) => (
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
      </div>

      {/* Modal Form Tambah Barang */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Tambah Barang Baru</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SKU Barang</label>
                <input name="sku" type="text" required placeholder="Contoh: FRM-PMK-01" className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none uppercase font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Barang</label>
                <input name="nama" type="text" required placeholder="Contoh: Form Pemrek Nasabah" className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                  <select name="kategori" required className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-sm bg-white">
                    <option value="Cetakan">Cetakan</option>
                    <option value="Buku">Buku</option>
                    <option value="ATK">ATK</option>
                    <option value="Merchandise">Merchandise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Satuan</label>
                  <select name="satuan" required className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-sm bg-white">
                    <option value="Pcs">Pcs</option>
                    <option value="Buku">Buku</option>
                    <option value="Rim">Rim</option>
                    <option value="Box">Box</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Batas Minimum (Alert Stok)</label>
                <input name="batas_minimum" type="number" required min="0" defaultValue="50" className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-sm" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-70">
                  {isSubmitting ? "Menyimpan..." : "Simpan Barang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}