"use client";

import { BarChart, Package, AlertTriangle, Clock } from "lucide-react";

export default function DashboardPage() {
  // Placeholder data
  const stats = [
    { name: "Total SKU", value: "1,250", icon: Package, color: "blue" },
    { name: "Stok Kritis", value: "15", icon: AlertTriangle, color: "red" },
    { name: "Permintaan Pending", value: "8", icon: Clock, color: "orange" },
    { name: "Barang Keluar (Bulan Ini)", value: "3,420", icon: BarChart, color: "emerald" },
  ];

  const colorClasses: { [key: string]: { bg: string, text: string } } = {
    blue: { bg: "bg-blue-100", text: "text-blue-600" },
    red: { bg: "bg-red-100", text: "text-red-600" },
    orange: { bg: "bg-orange-100", text: "text-orange-600" },
    emerald: { bg: "bg-emerald-100", text: "text-emerald-600" },
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Selamat Datang, Admin Gudang!</h1>
        <p className="text-slate-500 mt-1">Berikut adalah ringkasan aktivitas gudang Anda hari ini.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="glass-panel p-6 rounded-2xl flex items-center gap-5">
            <div className={`p-4 rounded-xl ${colorClasses[stat.color].bg} ${colorClasses[stat.color].text}`}>
              <stat.icon size={28} />
            </div>
            <div>
              <p className="text-slate-500 text-sm">{stat.name}</p>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="font-bold text-slate-800 mb-4">Aktivitas Terkini</h2>
          <p className="text-slate-400 text-center py-10">Grafik aktivitas akan ditampilkan di sini...</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="font-bold text-slate-800 mb-4">Barang Terlaris</h2>
          <p className="text-slate-400 text-center py-10">Daftar barang terlaris akan ditampilkan di sini...</p>
        </div>
      </div>
    </div>
  );
}