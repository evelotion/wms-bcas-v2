"use client";

import React, { useState } from "react";
import { Search, ChevronDown, ChevronRight, PackageOpen, ChevronLeft, Layers } from "lucide-react";
import { InventoryItem } from "./types";

// Helper untuk format Rupiah (Aman dari Hydration Error)
const formatRupiah = (angka: number) => {
  return "Rp " + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export default function InventoryClient({ initialData }: { initialData: InventoryItem[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredData = initialData.filter(item => 
    item.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="glass-panel rounded-2xl flex flex-col overflow-hidden">
      {/* HEADER & SEARCH BAR */}
      <div className="p-5 border-b border-slate-200/60 bg-white/40 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Layers size={20} className="text-blue-600" /> Rincian Barang
        </h2>
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-2.5 bg-white/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all shadow-sm placeholder:text-slate-400 font-medium text-slate-700"
            placeholder="Cari SKU atau Nama Barang..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* TABLE AREA */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4 w-10"></th>
              <th className="px-6 py-4">SKU</th>
              <th className="px-6 py-4">Nama Barang</th>
              <th className="px-6 py-4 text-right">Total Stok</th>
              <th className="px-6 py-4 text-right">Total Aset (FIFO)</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <PackageOpen className="h-12 w-12 text-slate-300 mb-3" />
                    <p className="font-bold text-slate-600 text-base">Aset Tidak Ditemukan</p>
                    <p className="text-xs mt-1">Coba gunakan kata kunci pencarian yang lain.</p>
                  </div>
                </td>
              </tr>
            ) : (
              currentItems.map((item) => (
                <React.Fragment key={item.id}>
                  {/* MAIN ROW */}
                  <tr 
                    className={`transition-all duration-300 cursor-pointer ${expandedRows[item.id] ? 'bg-blue-50/40 shadow-sm' : 'hover:bg-white/60 hover:shadow-sm'}`} 
                    onClick={() => toggleRow(item.id)}
                  >
                    <td className="px-6 py-4 text-slate-400">
                      <div className={`transition-transform duration-300 ${expandedRows[item.id] ? 'rotate-90 text-blue-600' : ''}`}>
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md text-xs border border-slate-200">
                        {item.sku}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 text-base">{item.nama}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-lg text-slate-700">{item.totalStok}</span>
                      <span className="text-slate-400 font-medium text-xs ml-1">{item.satuan}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                      {formatRupiah(item.totalNilai)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.totalStok <= item.batas_minimum ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Aman
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* EXPANDED NESTED ROW (BATCHES) */}
                  {expandedRows[item.id] && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={6} className="p-0">
                        {/* Wrapper for smooth 3D-like nested card */}
                        <div className="px-6 py-4 pl-16">
                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                            {/* Blue Accent Line on the left */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-600"></div>
                            
                            <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50/80 text-slate-500 text-xs border-b border-slate-100">
                                <tr>
                                  <th className="px-4 py-3 font-semibold pl-6">Rak / Lorong</th>
                                  <th className="px-4 py-3 font-semibold text-right">Harga per Unit</th>
                                  <th className="px-4 py-3 font-semibold text-right">Sisa Stok</th>
                                  <th className="px-4 py-3 font-semibold text-right pr-6">Subtotal Aset</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {item.batch_Barang.length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400 text-xs italic">
                                      Tidak ada batch tersedia di rak saat ini.
                                    </td>
                                  </tr>
                                ) : (
                                  item.batch_Barang.map((batch) => (
                                    <tr key={batch.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="px-4 py-3 pl-6 font-medium text-slate-700">
                                        <div className="flex items-center gap-2">
                                          Rak {batch.lokasi?.rak} 
                                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
                                            Lorong {batch.lokasi?.lorong}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-right text-slate-500 font-mono text-xs">
                                        {formatRupiah(batch.harga_satuan)}
                                      </td>
                                      <td className="px-4 py-3 text-right font-black text-slate-700">
                                        {batch.qty_sisa}
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-blue-600 pr-6">
                                        {formatRupiah(batch.qty_sisa * batch.harga_satuan)}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER PAGINATION */}
      {filteredData.length > 0 && (
        <div className="p-4 border-t border-slate-200/60 bg-white/40 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-slate-500 font-medium">
            Menampilkan <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> - <span className="font-bold text-slate-800">{Math.min(indexOfLastItem, filteredData.length)}</span> dari <span className="font-bold text-slate-800">{filteredData.length}</span> aset
          </div>
          
          <div className="flex gap-2 items-center">
            <button 
              onClick={prevPage} 
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div className="px-4 py-2 rounded-xl bg-blue-50/50 text-blue-700 font-bold border border-blue-100/50 text-sm shadow-inner">
              Hal {currentPage} / {totalPages}
            </div>
            
            <button 
              onClick={nextPage} 
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}