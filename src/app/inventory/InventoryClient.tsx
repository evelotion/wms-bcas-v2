"use client";

import React, { useState } from "react";
import { Search, ChevronDown, ChevronRight, PackageOpen } from "lucide-react";
import { InventoryItem } from "./types"; 

// Helper untuk format Rupiah
const formatRupiah = (angka: number) => {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(angka);
};

export default function InventoryClient({ initialData }: { initialData: InventoryItem[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const filteredData = initialData.filter(item => 
    item.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none sm:text-sm"
            placeholder="Cari SKU atau Nama Barang..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama Barang</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Stok</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Aset (FIFO)</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  <PackageOpen className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  Barang tidak ditemukan
                </td>
              </tr>
            ) : (
              filteredData.map((item) => (
                <React.Fragment key={item.id}>
                  <tr className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => toggleRow(item.id)}>
                    <td className="px-4 py-4">{expandedRows[item.id] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{item.sku}</td>
                    <td className="px-4 py-4 text-sm font-bold text-gray-900">{item.nama}</td>
                    <td className="px-4 py-4 text-sm font-bold text-right text-blue-600">
                      {item.totalStok} <span className="text-gray-500 font-normal text-xs">{item.satuan}</span>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-right text-emerald-600">
                      {formatRupiah(item.totalNilai)} {/* Menampilkan total nilai aset berdasarkan harga per batch */}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${item.totalStok <= item.batas_minimum ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {item.totalStok <= item.batas_minimum ? 'Low Stock' : 'Aman'}
                      </span>
                    </td>
                  </tr>

                  {expandedRows[item.id] && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="p-4 pl-14">
                        <table className="min-w-full divide-y divide-gray-200 border rounded-lg overflow-hidden bg-white">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs text-gray-500">Rak / Lorong</th>
                              <th className="px-3 py-2 text-left text-xs text-gray-500">Harga per Unit</th>
                              <th className="px-3 py-2 text-right text-xs text-gray-500">Sisa Stok</th>
                              <th className="px-3 py-2 text-right text-xs text-gray-500">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.batch_Barang.map((batch) => (
                              <tr key={batch.id} className="text-sm">
                                <td className="px-3 py-2">Rak {batch.lokasi?.rak} (Lorong {batch.lokasi?.lorong})</td>
                                <td className="px-3 py-2 text-right text-slate-600">{formatRupiah(batch.harga_satuan)}</td>
                                <td className="px-3 py-2 text-right font-bold">{batch.qty_sisa}</td>
                                <td className="px-3 py-2 text-right font-bold text-emerald-600">
                                  {formatRupiah(batch.qty_sisa * batch.harga_satuan)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}