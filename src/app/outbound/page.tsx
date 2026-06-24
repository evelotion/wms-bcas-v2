// src/app/outbound/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getOutboundFormData, createOutbound, getRecentOutbound } from "./actions";
import { PackageMinus, History, ArrowUpRightFromSquare, Send, Plus, X } from "lucide-react";
import { generateFPKB } from "@/lib/generateFpkb";

export default function OutboundPage() {
  const [formData, setFormData] = useState({ barang: [] });
  const [recentOutbounds, setRecentOutbounds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); // STATE BARU UNTUK MODAL

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
      setIsModalOpen(false); // Tutup modal
      fetchData(); 
    } else {
      alert("❌ " + res.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      {/* Header & Tombol Tambah */}
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

      {/* Tabel Full Width */}
      <div className="glass-panel p-6 rounded-2xl">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <History size={18} className="text-orange-600"/> Riwayat Outbound (Ledger)
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Waktu</th>
                <th className="px-4 py-3">Barang Info</th>
                <th className="px-4 py-3">Referensi</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 rounded-tr-lg">Lokasi Potong</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8">Memuat riwayat...</td></tr>
              ) : recentOutbounds.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Belum ada transaksi outbound.</td></tr>
              ) : (
                recentOutbounds.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.batch?.barang?.nama}
                      <div className="text-xs text-orange-600 font-mono mt-0.5">{item.batch?.barang?.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600">{item.referensi}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{item.qty_perubahan}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="bg-slate-100 px-2 py-1 rounded font-medium text-slate-600">
                        {item.batch?.lokasi?.lorong}-{item.batch?.lokasi?.rak}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FORM OUTBOUND */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <PackageMinus className="text-orange-600" size={24}/> Form Pengiriman
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto no-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Pilih Barang (Stok Tersedia)</label>
                  <select name="barangId" required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-slate-50">
                    <option value="">-- Pilih Barang --</option>
                    {formData.barang.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        [{b.sku}] {b.nama} (Stok: {b.totalStok})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Qty Keluar</label>
                    <input name="qty" type="number" min="1" required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tujuan / Cabang</label>
                    <input name="tujuan" type="text" required placeholder="Contoh: KCP Jatinegara" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-slate-50" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Referensi FPKB</label>
                  <input name="referensi" type="text" required placeholder="Contoh: FPKB-26-05-998" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-slate-50" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Keterangan Tambahan</label>
                  <textarea name="keterangan" rows={2} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-slate-50"></textarea>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-orange-600/30 disabled:opacity-70">
                    <Send size={18} /> {isSubmitting ? "Memproses FIFO..." : "Potong Stok & Cetak PDF"}
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