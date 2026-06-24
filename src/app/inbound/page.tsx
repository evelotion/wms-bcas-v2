// src/app/inbound/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getInboundFormData, createInbound, getRecentInbound } from "./actions";
import { PackagePlus, History, ArrowDownToLine, Save, Plus, X } from "lucide-react";

export default function InboundPage() {
  const [formData, setFormData] = useState({ barang: [], lokasi: [] });
  const [recentInbounds, setRecentInbounds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); // STATE BARU UNTUK MODAL

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
      setIsModalOpen(false); // Tutup modal setelah sukses
      fetchData(); 
    } else {
      alert("❌ " + res.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      {/* Header & Tombol Tambah */}
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

      {/* Tabel Full Width */}
      <div className="glass-panel p-6 rounded-2xl">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <History size={18} className="text-emerald-600"/> Riwayat Inbound (Ledger)
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Waktu</th>
                <th className="px-4 py-3">Barang & Batch Info</th>
                <th className="px-4 py-3">Referensi</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 rounded-tr-lg">Lokasi (Rak)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8">Memuat riwayat...</td></tr>
              ) : recentInbounds.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Belum ada transaksi inbound.</td></tr>
              ) : (
                recentInbounds.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.batch?.barang?.nama}
                      <div className="text-xs text-blue-600 font-mono mt-0.5">{item.batch?.barang?.sku}</div>
                      {(item.batch?.supplier || item.batch?.nomorator) && (
                        <div className="text-[10px] text-slate-500 mt-1 bg-white/60 px-2 py-0.5 rounded w-fit border border-slate-100">
                          {item.batch?.supplier} {item.batch?.nomorator ? `| Seri: ${item.batch.nomorator}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600">{item.referensi}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">+{item.qty_perubahan}</td>
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

      {/* MODAL FORM INBOUND */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <PackagePlus className="text-emerald-600" size={24}/> Form Penerimaan
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto no-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Pilih Barang</label>
                  <select name="barangId" required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-slate-50">
                    <option value="">-- Pilih Barang --</option>
                    {formData.barang.map((b: any) => (
                      <option key={b.id} value={b.id}>[{b.sku}] {b.nama}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Qty Masuk</label>
                    <input name="qty" type="number" min="1" required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Harga Satuan (Rp)</label>
                    <input name="harga" type="number" min="0" required defaultValue="0" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-slate-50" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Lokasi Penyimpanan (Rak)</label>
                  <select name="lokasiId" required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-slate-50">
                    <option value="">-- Pilih Lokasi --</option>
                    {formData.lokasi.map((l: any) => (
                      <option key={l.id} value={l.id}>{l.gudang} - Lorong {l.lorong} - Rak {l.rak}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Supplier</label>
                    <input name="supplier" type="text" placeholder="Contoh: PT. ABC" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nomorator/Seri</label>
                    <input name="nomorator" type="text" placeholder="Contoh: 001-100" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-slate-50" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Referensi (No. PO/DO/BAST)</label>
                  <input name="referensi" type="text" required placeholder="Contoh: PO-2026/05/123" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-slate-50" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Keterangan Tambahan</label>
                  <textarea name="keterangan" rows={2} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-slate-50"></textarea>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-70">
                    <Save size={18} /> {isSubmitting ? "Menyimpan..." : "Simpan Batch Masuk"}
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