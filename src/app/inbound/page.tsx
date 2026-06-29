"use client";

import { useEffect, useState, useRef } from "react";
import { getInboundFormData, createInbound, getRecentInbound } from "./actions";
import { PackagePlus, History, ArrowDownToLine, Save, Plus, X, ChevronLeft, ChevronRight, Search, ChevronDown } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

export default function InboundPage() {
  const [formData, setFormData] = useState({ barang: [], lokasi: [] });
  const [recentInbounds, setRecentInbounds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // === STATE PAGINATION ===
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State untuk SearchableSelect
  const [selectedBarangId, setSelectedBarangId] = useState("");
  const [selectedLokasiId, setSelectedLokasiId] = useState("");

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

  // === LOGIC PAGINATION ===
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = recentInbounds.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(recentInbounds.length / itemsPerPage);

  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

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
      setSelectedBarangId(""); 
      setSelectedLokasiId(""); 
      setIsModalOpen(false); 
      fetchData();
    } else {
      alert("❌ " + res.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="w-full space-y-6 pb-10">
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <ArrowDownToLine size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Inbound (Barang Masuk)</h1>
            <p className="text-sm text-slate-500">Catat penerimaan barang & entitas Batch baru (Auto Smart-Trigger).</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30"
        >
          <Plus size={18} /> Tambah Inbound
        </button>
      </div>

      <div className="glass-panel flex flex-col rounded-2xl overflow-hidden">
        <div className="p-6 pb-4 border-b border-white/40">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <History size={18} className="text-emerald-600"/> Riwayat Inbound (Ledger)
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Waktu</th>
                <th className="px-6 py-4">Barang & Batch Info</th>
                <th className="px-6 py-4">Referensi</th>
                <th className="px-6 py-4 text-right">Qty</th>
                <th className="px-6 py-4">Lokasi (Rak)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8">Memuat riwayat...</td></tr>
              ) : recentInbounds.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Belum ada transaksi inbound.</td></tr>
              ) : (
                currentItems.map((item) => (
                  <tr key={item.id} className="hover:bg-white/40 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {item.batch?.barang?.nama}
                      <div className="text-xs text-blue-600 font-mono mt-0.5">{item.batch?.barang?.sku}</div>
                      {(item.batch?.supplier || item.batch?.nomorator) && (
                        <div className="text-[10px] text-slate-500 mt-1 bg-white/60 px-2 py-0.5 rounded w-fit border border-slate-100">
                          {item.batch?.supplier} {item.batch?.nomorator ? `| Seri: ${item.batch.nomorator}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600">{item.referensi}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">+{item.qty_perubahan}</td>
                    <td className="px-6 py-4 text-xs">
                      <span className="bg-white/60 border border-slate-200 px-2 py-1 rounded font-medium text-slate-600">
                        {item.batch?.lokasi?.lorong}-{item.batch?.lokasi?.rak}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER PAGINATION (Tema Hijau/Emerald) */}
        {!isLoading && recentInbounds.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 mt-auto">
            <div className="text-sm text-slate-500">
              Menampilkan <span className="font-semibold text-slate-800">{indexOfFirstItem + 1}</span> - <span className="font-semibold text-slate-800">{Math.min(indexOfLastItem, recentInbounds.length)}</span> dari <span className="font-semibold text-slate-800">{recentInbounds.length}</span> mutasi
            </div>
            <div className="flex gap-2">
              <button onClick={prevPage} disabled={currentPage === 1} className="p-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-all">
                <ChevronLeft size={18} />
              </button>
              <div className="px-4 py-2 rounded-lg bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200 text-sm">
                Hal {currentPage} / {totalPages}
              </div>
              <button onClick={nextPage} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-all">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL FORM INBOUND FIX Z-INDEX & OVERFLOW */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-100 flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ArrowDownToLine size={20} className="text-emerald-600"/> Tambah Inbound Baru
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
            </div>
            
            {/* PERUBAHAN: overflow-visible dan pb-24 agar dropdown leluasa render ke bawah */}
            <div className="p-6 overflow-visible pb-24">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Barang</label>
                    <SearchableSelect 
                      name="barangId" 
                      options={(formData as any).barang?.map((b:any) => ({id: b.id, label: b.nama, sku: b.sku})) || []} 
                      value={selectedBarangId} 
                      onChange={setSelectedBarangId} 
                      placeholder="Ketik SKU atau Nama Barang..." 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lokasi Rak</label>
                    <SearchableSelect 
                      name="lokasiId" 
                      options={(formData as any).lokasi?.map((l:any) => ({id: l.id, label: `Rak ${l.rak} (Lorong ${l.lorong})`, sku: l.gudang})) || []} 
                      value={selectedLokasiId} 
                      onChange={setSelectedLokasiId} 
                      placeholder="Cari Lokasi Rak..." 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Qty Masuk</label>
                    <input name="qty" type="number" min="1" required className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Harga Satuan (Rp)</label>
                    <input name="harga" type="number" min="0" required defaultValue="0" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Surat/Referensi FPP</label>
                    <input name="referensi" type="text" required placeholder="Contoh: PO-2026-001" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Supplier / Vendor</label>
                    <input name="supplier" type="text" placeholder="Opsional" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nomorator / Serial</label>
                    <input name="nomorator" type="text" placeholder="Opsional" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan Tambahan</label>
                    <textarea name="keterangan" rows={2} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"></textarea>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors">
                    Batal
                  </button>
                  <button type="submit" disabled={isSubmitting || !selectedBarangId || !selectedLokasiId} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-md shadow-emerald-500/30 disabled:opacity-70">
                    {isSubmitting ? "Memproses..." : "Simpan Inbound"}
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