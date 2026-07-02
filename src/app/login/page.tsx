"use client";

import { useState } from "react";
import { Package2, Lock, User, ArrowRight, ShieldCheck } from "lucide-react";
import { loginUser } from "./actions";

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const res = await loginUser(formData);

    if (res.success) {
      window.location.href = "/"; // Force reload ke dashboard
    } else {
      setErrorMsg(res.error || "Gagal login");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100/50 -z-10"></div>
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl -z-10"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -z-10"></div>

      <div className="w-full max-w-md glass-panel p-8 md:p-10 rounded-3xl shadow-2xl relative">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <ShieldCheck size={100} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-600/30">
              <Package2 className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
              GudangSync.
            </h1>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-slate-800">Selamat Datang Kembali</h2>
            <p className="text-sm text-slate-500 mt-1">Silakan masuk menggunakan kredensial Anda.</p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl text-center font-medium flex items-center justify-center gap-2">
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 ml-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-400" />
                </div>
                <input 
                  type="text" 
                  name="username"
                  required
                  defaultValue="admin"
                  className="w-full pl-11 pr-4 py-3 bg-white/50 border border-white/60 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none transition-all text-slate-700 font-medium placeholder:text-slate-400"
                  placeholder="Masukkan username..." 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-400" />
                </div>
                <input 
                  type="password" 
                  name="password"
                  required
                  defaultValue="123"
                  className="w-full pl-11 pr-4 py-3 bg-white/50 border border-white/60 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none transition-all text-slate-700 font-medium placeholder:text-slate-400"
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-xl shadow-blue-600/30 disabled:opacity-70 group"
            >
              {isSubmitting ? "Memverifikasi..." : "Masuk ke Sistem"}
              {!isSubmitting && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200/50 text-center">
            <p className="text-xs text-slate-400">
              GudangSync v2.0 - Core Ledger System<br/>
              Akses terbatas untuk personil yang berwenang.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper icon
const AlertCircle = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
);