"use client";

import { useEffect, useState } from "react";
import { getOutboundFormData, createOutbound, getRecentOutbound } from "./actions";
import { PackageMinus, History, ArrowUpRightFromSquare, Send, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { generateFPKB } from "@/lib/generateFpkb";

export default function OutboundPage() {
  const [formData, setFormData] = useState({ barang: [] });
  const [recentOutbounds, setRecentOutbounds] = useState<any[]>([]);
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
      getOutboundFormData(),
      getRecentOutbound()
    ]);
    setFormData(formOptions as any);
    setRecentOutbounds(history);
    setIsLoading(false);
  };

  // === LOGIC PAGINATION ===
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = recentOutbounds.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(recentOutbounds.length / itemsPerPage);

  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formElement = e.currentTarget;
    const data = new FormData(formElement);
    
    const barangId = data.get("barangId") as string;
    const selectedBarang: any = formData.barang.find((b: any) => b.id === barangId);
    
    const formValues = {
      referensi: data.get("referensi") as string,
      tujuan: data.get("tujuan") as string,
      keterangan: data.get("keterangan") as string,
      qty: parseInt(data.get("qty") as string),
      barangNama: selectedBarang?.nama || "Unknown",
      barangSku: selectedBarang?.sku || "Unknown",
    };

    const res = await createOutbound(data);
    
    if (res.success) {
      alert("✅ Barang berhasil dialokasikan!\n\nInstruksi Pengambilan (FIFO):\n" + res.instruksi?.join("\n"));
      
      generateFPKB({
        ...formValues,
        instruksiPicker: res.instruksi || [],
      });

      formElement.reset();
      setIsModalOpen(false); 
      fetchData(); 
    } else {
      alert("❌ " + res.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-orange-500">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
            <ArrowUpRightFromSquare size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Outbound (Barang Keluar)</h1>
            <p className="text-sm text-slate-500">Sistem otomatis alokasi FIFO & Cetak Bukti FPKB.</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-600/30"
        >
          <Plus size={18} /> Tambah Outbound
        </button>
      </div>

      <div className="glass-panel flex flex-col rounded-2xl overflow-hidden">
        <div className="p-6 pb-4 border-b border-white/40">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <History size={18} className="text-orange-600"/> Riwayat Outbound (Ledger)
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Waktu</th>
                <th className="px-6 py-4">Barang Info</th>
                <th className="px-6 py-4">Referensi</th>
                <th className="px-6 py-4 text-right">Qty</th>
                <th className="px-6 py-4">Lokasi Potong</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8">Memuat riwayat...</td></tr>
              ) : recentOutbounds.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Belum ada transaksi outbound.</td></tr>
              ) : (
                currentItems.map((item) => (
                  <tr key={item.id} className="hover:bg-white/40 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {item.batch?.barang?.nama}
                      <div className="text-xs text-orange-600 font-mono mt-0.5">{item.batch?.barang?.sku}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600">{item.referensi}</td>
                    <td className="px-6 py-4 text-right font-bold text-red-600">{item.qty_perubahan}</td>
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

        {/* FOOTER PAGINATION (Tema Orange) */}
        {!isLoading && recentOutbounds.length > 0 && (
          <div className="p-4 border-t border-white/40 bg-white/20 flex flex-col sm:flex-row justify-between items-center gap-4 mt-auto">
            <div className="text-sm text-slate-500">
              Menampilkan <span className="font-semibold text-slate-800">{indexOfFirstItem + 1}</span> - <span className="font-semibold text-slate-800">{Math.min(indexOfLastItem, recentOutbounds.length)}</span> dari <span className="font-semibold text-slate-800">{recentOutbounds.length}</span> mutasi
            </div>
            <div className="flex gap-2">
              <button onClick={prevPage} disabled={currentPage === 1} className="p-2 rounded-lg border border-white/40 bg-white/50 text-slate-600 hover:bg-white disabled:opacity-50 transition-all">
                <ChevronLeft size={18} />
              </button>
              <div className="px-4 py-2 rounded-lg bg-orange-50/50 text-orange-700 font-semibold border border-orange-100 text-sm">
                Hal {currentPage} / {totalPages}
              </div>
              <button onClick={nextPage} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-white/40 bg-white/50 text-slate-600 hover:bg-white disabled:opacity-50 transition-all">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL FORM OUTBOUND (Tetap sama) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          {/* ... Isi modal sama persis kayak sebelumnya ... */}
        </div>
      )}
    </div>
  );
}