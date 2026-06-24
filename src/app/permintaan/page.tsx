"use client";

import { useEffect, useState } from "react";
// FIX 1: Import nama fungsi yang persis sama dengan yang ada di actions.ts
import { getPermintaanFormData, createPermintaan, getDaftarPermintaan, approvePermintaan } from "./actions";
import { generateFPKB } from "@/lib/generateFpkb";
import { ClipboardList, CheckCircle, Clock, AlertCircle, FilePlus } from "lucide-react";

export default function PermintaanPage() {
  const [barangList, setBarangList] = useState<any[]>([]);
  const [permintaanList, setPermintaanList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [formOptions, requests] = await Promise.all([
      getPermintaanFormData(),
      getDaftarPermintaan()
    ]);
    
    // Sesuaikan cara ekstrak data array-nya
    setBarangList((formOptions as any).barang || []);
    setPermintaanList(requests || []);
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    // FIX 2: Gunakan createPermintaan
    const res = await createPermintaan(formData);
    
    if (res.success) {
      alert("✅ Permintaan berhasil dibuat! Menunggu Approval SPV.");
      e.currentTarget.reset();
      fetchData();
    } else {
      alert("❌ " + res.error);
    }
    setIsSubmitting(false);
  };

  const handleApprove = async (id: string) => {
    if (!confirm("Approve permintaan ini & jalankan FIFO?")) return;
    
    setProcessingId(id);
    const res = await approvePermintaan(id);
    
    if (res.success) {
      // FIX 3: Fallback array kosong biar TypeScript gak error
      const instruksi = res.instruksi || [];
      
      if (instruksi.length > 0) {
        alert("✅ Approval Berhasil!\n\nInstruksi Gudang:\n" + instruksi.join("\n"));
      } else {
        alert("⚠️ Approval selesai, tapi tidak ada stok yang bisa ditarik (100% OUTSTANDING).");
      }

      // FIX 4: Susun data PDF dari state tabel yang udah ada di frontend
      const reqData = permintaanList.find(r => r.id === id);
      if (reqData && instruksi.length > 0) {
        generateFPKB({
          referensi: reqData.nomor_request,
          tujuan: reqData.cabang,
          keterangan: reqData.keterangan || `Fulfillment Request Cabang`,
          qty: reqData.details[0]?.qty_disetujui || reqData.details[0]?.qty_diminta || 0,
          barangNama: reqData.details[0]?.barang?.nama || "Item Requisition",
          barangSku: reqData.details[0]?.barang?.sku || "SKU",
          instruksiPicker: instruksi
        });
      }

      fetchData();
    } else {
      alert("❌ " + res.error);
    }
    setProcessingId(null);
  };

  // Helper Warna Status
  const getStatusBadge = (status: string) => {
    if (status === 'APPROVED' || status === 'FULFILLED') return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle size={12}/> {status}</span>;
    if (status === 'PENDING') return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold flex items-center gap-1 w-fit"><Clock size={12}/> PENDING</span>;
    if (status === 'OUTSTANDING') return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold flex items-center gap-1 w-fit"><AlertCircle size={12}/> OUTSTANDING</span>;
    return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-bold w-fit">{status}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="glass-panel p-6 rounded-2xl flex items-center gap-3 border-l-4 border-l-blue-500">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
          <ClipboardList size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Requisition (Permintaan Cabang)</h1>
          <p className="text-sm text-slate-500">Buat permintaan dan setujui untuk memotong stok gudang (Smart OUTSTANDING).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Permintaan Baru */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-2xl h-fit">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FilePlus size={18} className="text-blue-600"/> Buat Request Baru
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tujuan / Cabang</label>
              <input name="cabang" type="text" required placeholder="Contoh: KCP Jatinegara" className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama PIC Pemohon</label>
              <input name="pic_nama" type="text" required placeholder="Contoh: Budi Santoso" className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Barang</label>
              <select name="barangId" required className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white/50">
                <option value="">-- Pilih Barang --</option>
                {barangList.map((b: any) => (
                  <option key={b.id} value={b.id}>[{b.sku}] {b.nama}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Qty Diminta</label>
              <input name="qty" type="number" min="1" required className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan (Opsional)</label>
              <textarea name="keterangan" rows={2} className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"></textarea>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-blue-600/30 disabled:opacity-70">
              {isSubmitting ? "Mengirim..." : "Submit Permintaan"}
            </button>
          </form>
        </div>

        {/* Tabel Approval */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle size={18} className="text-blue-600"/> Daftar Menunggu Approval
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-4 py-3">No. Request / Tgl</th>
                  <th className="px-4 py-3">Cabang & PIC</th>
                  <th className="px-4 py-3">Detail Barang</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Aksi (SPV)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/40">
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-8">Memuat data...</td></tr>
                ) : permintaanList.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-500">Belum ada request masuk.</td></tr>
                ) : (
                  permintaanList.map((req) => (
                    <tr key={req.id} className="hover:bg-white/40">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{req.nomor_request}</div>
                        <div className="text-xs text-slate-500">{new Date(req.createdAt).toLocaleDateString('id-ID')}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">{req.cabang}</div>
                        <div className="text-xs text-slate-500">PIC: {req.pic_nama}</div>
                      </td>
                      <td className="px-4 py-3">
                        {req.details.map((d: any) => (
                          <div key={d.id} className="mb-2 last:mb-0 border-b border-slate-200/50 pb-1 last:border-0 last:pb-0">
                            <div className="font-medium text-blue-700 text-xs">{d.barang.nama}</div>
                            <div className="text-xs flex justify-between mt-1">
                              <span>Minta: <b className="text-slate-800">{d.qty_diminta}</b></span>
                              <span>Dapat: <b className="text-emerald-600">{d.qty_disetujui}</b></span>
                            </div>
                            <div className="mt-1">{getStatusBadge(d.status_item)}</div>
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(req.status)}</td>
                      <td className="px-4 py-3 text-center">
                        {req.status === 'PENDING' ? (
                          <button 
                            onClick={() => handleApprove(req.id)}
                            disabled={processingId === req.id}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            {processingId === req.id ? "Proses..." : "Approve"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Selesai</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}