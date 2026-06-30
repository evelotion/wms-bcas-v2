"use client";

import { useEffect, useState } from "react";
import { Package, ArrowDownRight, ArrowUpRight, TriangleAlert as AlertTriangle, Clock, Activity, ShieldCheck } from "lucide-react";
import { getDashboardStats } from "./actions"; // Pastikan path ini benar sesuai struktur lo

export default function DashboardPage() {
  const [dbStats, setDbStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const data = await getDashboardStats();
      setDbStats(data);
    };
    fetchStats();
  }, []);

  const stats = [
    { label: "Total SKU Aktif", value: dbStats?.totalSku || 0, icon: Package, color: "text-blue-600", bg: "bg-blue-100/50", border: "border-blue-200" },
    { label: "Inbound (Bulan Ini)", value: `+${dbStats?.totalInbound || 0}`, icon: ArrowDownRight, color: "text-emerald-600", bg: "bg-emerald-100/50", border: "border-emerald-200" },
    { label: "Outbound (Bulan Ini)", value: `-${dbStats?.totalOutbound || 0}`, icon: ArrowUpRight, color: "text-orange-600", bg: "bg-orange-100/50", border: "border-orange-200" },
    { label: "Stok Menipis", value: dbStats?.lowStockCount || 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100/50", border: "border-red-200" },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      
      {/* Premium Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-600 to-violet-800 p-8 md:p-10 shadow-xl shadow-blue-900/20 text-white">
        <div className="absolute -right-20 -top-20 opacity-10">
          <ShieldCheck size={350} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold mb-4 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Sistem Aktif & Tersinkronisasi
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">
              Dashboard Gudang<span className="text-blue-300">Sync</span>.
            </h1>
            <p className="text-blue-100 max-w-xl leading-relaxed">
              Ringkasan real-time aktivitas logistik, alokasi FIFO, dan pemantauan stok minimum aset.
            </p>
          </div>
          <div className="glass-panel !bg-white/10 !border-white/20 !shadow-none px-6 py-4 rounded-2xl flex flex-col items-end">
            <span className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">Tanggal Hari Ini</span>
            <span className="text-lg font-bold flex items-center gap-2">
              <Clock size={18} className="text-blue-300"/> 
              {new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className={`glass-panel glass-card-hover p-6 rounded-2xl flex items-center gap-5 border ${stat.border}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${stat.bg}`}>
              <stat.icon size={26} className={stat.color} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">{stat.label}</p>
              {/* BAGIAN YANG DIPERBAIKI: Menggunakan div, bukan p */}
              <div className="text-3xl font-black text-slate-800 mt-1">
                {dbStats === null ? <Loader /> : stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid Layout untuk Peringatan & Aktivitas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Peringatan Sistem (2 Column di Desktop) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={20} /> Peringatan Stok Minimum
            </h3>
          </div>
          
          <div className="space-y-3">
            {dbStats === null ? (
              <p className="text-slate-500 text-sm py-4">Memeriksa database...</p>
            ) : dbStats.lowStockAlerts?.length === 0 ? (
              <div className="p-5 bg-emerald-50/50 text-emerald-700 text-sm rounded-xl border border-emerald-100/50 flex flex-col items-center justify-center text-center">
                <ShieldCheck size={32} className="mb-2 text-emerald-500 opacity-50" />
                <b>Kondisi Aman!</b> Semua stok barang saat ini berada di atas batas minimum.
              </div>
            ) : (
              dbStats.lowStockAlerts?.map((alert: any) => (
                <div key={alert.id} className="p-4 bg-red-50/50 text-red-700 text-sm rounded-xl border border-red-100 flex justify-between items-center transition-colors hover:bg-red-50">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-100 rounded-lg text-red-600 mt-0.5 shrink-0"><AlertTriangle size={16} /></div>
                    <div>
                      <p className="font-bold text-slate-800">{alert.nama}</p>
                      <p className="text-xs text-slate-500 mt-1">SKU: <span className="font-mono">{alert.sku}</span> | Batas Aman: {alert.batas_minimum}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-xl text-red-600">{alert.totalStok}</span>
                    <span className="text-xs ml-1 font-medium">{alert.satuan}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions / Info (1 Column di Desktop) */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-2xl bg-gradient-to-b from-white/60 to-slate-50/60">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Activity className="text-blue-500" size={20} /> Status Sistem
            </h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-slate-100">
              <span className="text-sm font-medium text-slate-600">Database (Neon)</span>
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Connected
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-slate-100">
              <span className="text-sm font-medium text-slate-600">FIFO Engine</span>
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
              </span>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-200 text-center">
              <p className="text-xs text-slate-400">GudangSync v2.0 - Core Ledger System</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Simple loader component
const Loader = () => <div className="animate-pulse h-8 w-16 bg-slate-200 rounded-lg"></div>;