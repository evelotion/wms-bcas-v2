"use client";

import { useEffect, useState } from "react";
import { Archive, PackagePlus, ArrowRightLeft, Download, Filter } from "lucide-react";
import * as XLSX from "xlsx";
import { getLaporanData } from "./actions";

export default function LaporanPage() {
  const [selectedBulan, setSelectedBulan] = useState("all");
  const [laporanData, setLaporanData] = useState<any>({ persediaan: [], laporanMasuk: [], laporanKeluar: [] });
  const [isLoading, setIsLoading] = useState(true);

  // Generate opsi bulan (6 bulan terakhir)
  const getBulanOptions = () => {
    const options = [];
    const date = new Date();
    for (let i = 0; i < 6; i++) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const label = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      options.push({ value: `${year}-${month}`, label });
      date.setMonth(date.getMonth() - 1);
    }
    return options;
  };

  useEffect(() => {
    fetchData();
  }, [selectedBulan]);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getLaporanData(selectedBulan);
    setLaporanData(data);
    setIsLoading(false);
  };

  const handleDownloadExcel = (data: any[], fileName: string) => {
    if (data.length === 0) {
      alert("Tidak ada data untuk diunduh pada periode ini.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan");
    XLSX.writeFile(workbook, `${fileName}_${selectedBulan}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header & Filter */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pusat Unduh Laporan</h1>
          <p className="text-sm text-slate-500">Unduh rekapitulasi Ledger GudangSync V2 dalam format Excel.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white/60 p-2 rounded-xl border border-slate-200">
          <Filter size={18} className="text-slate-400 ml-2" />
          <select 
            value={selectedBulan} 
            onChange={(e) => setSelectedBulan(e.target.value)}
            className="bg-transparent border-none outline-none text-sm font-medium text-slate-700 pr-4"
          >
            <option value="all">Keseluruhan Waktu</option>
            {getBulanOptions().map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CARD 1: STOK TERKINI */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col h-full relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Archive size={120} />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="p-3 bg-emerald-100 w-fit rounded-xl mb-4 text-emerald-600">
              <Archive size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Persediaan Terkini</h3>
            <p className="text-sm text-slate-500 mt-2 mb-6 flex-1">
              Laporan <i>real-time</i> sisa akumulasi stok barang dari seluruh Batch yang tersedia.
            </p>
            <button 
              onClick={() => handleDownloadExcel(laporanData.persediaan, "Stok_Terkini")}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-500/30 disabled:opacity-50"
            >
              <Download size={16} /> Download Excel ({laporanData.persediaan?.length || 0})
            </button>
          </div>
        </div>

        {/* CARD 2: BARANG MASUK */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col h-full relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <PackagePlus size={120} />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="p-3 bg-blue-100 w-fit rounded-xl mb-4 text-blue-600">
              <PackagePlus size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Laporan Inbound</h3>
            <p className="text-sm text-slate-500 mt-2 mb-4 flex-1">
              Rekap histori mutasi masuk dari Supplier/Migrasi berdasarkan filter waktu.
            </p>
            <button 
              onClick={() => handleDownloadExcel(laporanData.laporanMasuk, "Laporan_Masuk")}
              disabled={isLoading || laporanData.laporanMasuk?.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-500/30 disabled:opacity-50"
            >
              <Download size={16} /> Download Excel ({laporanData.laporanMasuk?.length || 0})
            </button>
          </div>
        </div>

        {/* CARD 3: BARANG KELUAR */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col h-full relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <ArrowRightLeft size={120} />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="p-3 bg-orange-100 w-fit rounded-xl mb-4 text-orange-600">
              <ArrowRightLeft size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Laporan Outbound</h3>
            <p className="text-sm text-slate-500 mt-2 mb-4 flex-1">
              Rekap distribusi & alokasi FIFO barang ke Cabang berdasarkan filter waktu.
            </p>
            <button 
              onClick={() => handleDownloadExcel(laporanData.laporanKeluar, "Laporan_Keluar")}
              disabled={isLoading || laporanData.laporanKeluar?.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-orange-500/30 disabled:opacity-50"
            >
              <Download size={16} /> Download Excel ({laporanData.laporanKeluar?.length || 0})
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}