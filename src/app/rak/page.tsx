"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { getLokasiRak, createLokasiRak } from "./actions";
import { Plus, MapPin, QrCode, ServerCrash } from "lucide-react";

export default function ManajemenRakPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getLokasiRak();
    setLocations(data);
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const res = await createLokasiRak(formData);
    
    if (res.success) {
      setIsModalOpen(false);
      fetchData();
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
            <MapPin className="text-blue-600" /> Manajemen Lokasi Rak
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pengaturan tata letak gudang dan cetak label QR Smart Scanner.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-600/30"
        >
          <Plus size={18} /> Tambah Rak
        </button>
      </div>

      {/* Grid Rak & QR Code */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Memuat data lokasi...</div>
      ) : locations.length === 0 ? (
        <div className="glass-panel text-center py-16 text-slate-500 flex flex-col items-center justify-center rounded-2xl">
          <QrCode className="text-slate-300 mb-3" size={48} />
          Belum ada konfigurasi rak. Silakan tambah lokasi baru.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {locations.map((loc) => (
            <div key={loc.id} className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center group hover:-translate-y-1 transition-transform">
              <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 mb-4 group-hover:shadow-md transition-shadow">
                <QRCode 
                  value={loc.qr_code} 
                  size={120}
                  level="H" // High error correction
                  className="w-full h-auto"
                />
              </div>
              <h3 className="font-bold text-slate-800 text-lg uppercase">{loc.gudang}</h3>
              <div className="flex gap-2 mt-2 text-sm font-medium text-slate-600">
                <span className="bg-slate-200/60 px-2 py-1 rounded-md">Lorong {loc.lorong}</span>
                <span className="bg-slate-200/60 px-2 py-1 rounded-md">Rak {loc.rak}</span>
              </div>
              <p className="text-xs font-mono text-blue-600 mt-4 truncate w-full px-2 py-1 bg-blue-50/50 rounded-lg border border-blue-100/50">
                {loc.qr_code}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form Tambah Rak */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <QrCode size={20} className="text-blue-600"/> Setup Lokasi Baru
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Gudang</label>
                <input name="gudang" type="text" required placeholder="Contoh: UTAMA" className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kode Lorong</label>
                  <input name="lorong" type="text" required placeholder="Contoh: A" className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-sm uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Rak</label>
                  <input name="rak" type="text" required placeholder="Contoh: 01" className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-sm uppercase" />
                </div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mt-2">
                <p className="text-xs text-blue-700 flex items-start gap-2">
                  <MapPin size={14} className="shrink-0 mt-0.5" />
                  Sistem otomatis meng-generate QR Code berdasar kombinasi Gudang, Lorong, dan Rak.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-70">
                  {isSubmitting ? "Menyimpan..." : "Generate QR Rak"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}