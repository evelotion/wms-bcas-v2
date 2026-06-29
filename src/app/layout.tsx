"use client";

import { useState } from "react"; // Tambah useState
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Database, ArrowDownToLine, ArrowUpRightFromSquare, FileQuestion, FileText, Package2, Bell, Search, LogOut, Archive } from "lucide-react";
import { logoutUser } from "@/app/login/actions"; // Sesuaikan path actions lo

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false); // State untuk Dropdown
  const isLoginPage = pathname === "/login";

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/" },
    { name: "Master Barang", icon: Database, path: "/master" },
    { name: "Inbound (Masuk)", icon: ArrowDownToLine, path: "/inbound" },
    { name: "Requisition", icon: FileQuestion, path: "/permintaan" },
    { name: "Outstanding", icon: Archive, path: "/outstanding" }, // <--- INI BARU DITAMBAHIN
    { name: "Laporan", icon: FileText, path: "/laporan" },
  ];

  if (isLoginPage) {
    return <html lang="id"><body className={`${inter.className} antialiased`}>{children}</body></html>;
  }

  return (
    <html lang="id">
      <body className={`${inter.className} flex h-screen overflow-hidden antialiased`}>
        <aside className="w-64 glass-sidebar hidden md:flex flex-col relative z-30">
          <div className="h-20 flex items-center px-8 border-b border-white/50">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20"><Package2 className="text-white" size={24} /></div>
              <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">GudangSync.</span>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 no-scrollbar">
            <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Menu Utama</p>
            {menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isActive ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "text-slate-500 hover:bg-blue-50 hover:text-blue-700"}`}>
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
          <header className="h-20 glass-panel border-x-0 border-t-0 flex items-center justify-between px-8 z-20">
            <div className="flex items-center gap-4 bg-white/50 px-4 py-2 rounded-full border border-white/60 w-96 shadow-sm">
              <Search size={18} className="text-slate-400" />
              <input type="text" placeholder="Cari SKU atau nama barang..." className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400" />
            </div>
            
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors"><Bell size={20} /></button>
              <div className="h-8 w-px bg-slate-200"></div>
              
              {/* DROPDOWN USER */}
              <div className="relative">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setDropdownOpen(!dropdownOpen)}>
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-slate-700">Admin Gudang</p>
                    <p className="text-xs text-slate-500">Super User</p>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-full flex items-center justify-center shadow-md text-white font-bold">AG</div>
                </div>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-40 glass-panel rounded-xl py-2 shadow-xl z-50 border border-slate-100">
                    <button 
                      onClick={async () => {
                        await logoutUser();
                        window.location.href = "/login";
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 font-bold hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* AREA KONTEN & FOOTER */}
          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
            <div className="p-6 md:p-10 flex-1">
              {children}
            </div>
            
            {/* FOOTER GELAP */}
            <footer className="bg-white border-t border-slate-200 text-slate-500 py-5 px-8 mt-auto flex flex-col sm:flex-row justify-between items-center gap-2">
              <p className="text-xs">© 2026 GudangSync V2. All rights reserved.</p>
              <p className="text-xs font-medium text-slate-600">BCA Syariah - Logistik & Asset</p>
            </footer>
          </div>
        </main>
      </body>
    </html>
  );
}