"use client";

import { useEffect, useState } from "react";
import { getInboundFormData, createInbound, getRecentInbound } from "./actions";
import { PackagePlus, History, ArrowDownToLine, Save, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";

export default function InboundPage() {
  const [formData, setFormData] = useState({ barang: [], lokasi: [] });
  const [recentInbounds, setRecentInbounds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // === STATE PAGINATION ===
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
      setIsModalOpen(false); 
      fetchData(); 
    } else {
      alert("❌ " + res.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
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
          <div className="p-4 border-t border-white/40 bg-white/20 flex flex-col sm:flex-row justify-between items-center gap-4 mt-auto">
            <div className="text-sm text-slate-500">
              Menampilkan <span className="font-semibold text-slate-800">{indexOfFirstItem + 1}</span> - <span className="font-semibold text-slate-800">{Math.min(indexOfLastItem, recentInbounds.length)}</span> dari <span className="font-semibold text-slate-800">{recentInbounds.length}</span> mutasi
            </div>
            <div className="flex gap-2">
              <button onClick={prevPage} disabled={currentPage === 1} className="p-2 rounded-lg border border-white/40 bg-white/50 text-slate-600 hover:bg-white disabled:opacity-50 transition-all">
                <ChevronLeft size={18} />
              </button>
              <div className="px-4 py-2 rounded-lg bg-emerald-50/50 text-emerald-700 font-semibold border border-emerald-100 text-sm">
                Hal {currentPage} / {totalPages}
              </div>
              <button onClick={nextPage} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-white/40 bg-white/50 text-slate-600 hover:bg-white disabled:opacity-50 transition-all">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL FORM INBOUND (Tetap sama) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          {/* ... Isi modal sama persis kayak sebelumnya ... */}
        </div>
      )}
    </div>
  );
}