"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Database, ArrowDownToLine, FileQuestion, FileText, Package2, Bell, Search, LogOut, Archive, Package, ClipboardCheck } from "lucide-react";
import { logoutUser } from "@/app/login/actions";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Staf",
  GUDANG: "Admin Gudang",
};

// Terima props session dari Server Layout
export default function ClientAppShell({ 
  children, 
  session 
}: { 
  children: React.ReactNode;
  session: { id: string; nama: string; role: string } | null;
}) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  // Menu Dinamis (Tanpa pusing mikirin useEffect lagi)
  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/", roles: ["ADMIN", "GUDANG"] },
    { name: "Inventory (Stok)", icon: Package, path: "/inventory", roles: ["ADMIN", "GUDANG"] },
    { name: "Master Barang", icon: Database, path: "/master", roles: ["ADMIN", "GUDANG"] },
    { name: "Inbound (Masuk)", icon: ArrowDownToLine, path: "/inbound", roles: ["GUDANG"] },
    { name: "Requisition", icon: FileQuestion, path: "/permintaan", roles: ["ADMIN", "GUDANG"] },
    { name: "FPKB", icon: ClipboardCheck, path: "/fpkb", roles: ["ADMIN", "GUDANG"] },
    { name: "Outstanding", icon: Archive, path: "/outstanding", roles: ["ADMIN", "GUDANG"] },
    { name: "Laporan", icon: FileText, path: "/laporan", roles: ["ADMIN", "GUDANG"] },
  ];

  const filteredMenu = menuItems.filter(item => !session || item.roles.includes(session.role));

  return (
    <>
      <aside className="w-64 hidden md:flex flex-col relative z-30 bg-gradient-to-b from-white via-white to-slate-50/80 border-r border-slate-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="h-20 flex items-center px-6 border-b border-slate-100/80 bg-gradient-to-r from-blue-50/40 to-transparent">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-blue-600/30">
              <Package2 className="text-white" size={22} />
            </div>
            <div>
              <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 leading-none">GudangSync</span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">WMS v2</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 no-scrollbar">
          <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Menu Utama</p>
          {filteredMenu.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <div className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-semibold text-sm group ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25"
                    : "text-slate-600 hover:bg-blue-50/60 hover:text-blue-700"
                }`}>
                  {isActive && (
                    <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full"></div>
                  )}
                  <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "" : "group-hover:scale-110 transition-transform"} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-100 mt-auto">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-black">{session ? session.nama.substring(0, 2).toUpperCase() : "??"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-700 truncate">{session ? session.nama : "Guest"}</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{session ? ROLE_LABEL[session.role] || session.role : "..."}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        <header className="h-20 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-8 z-20 shadow-sm shadow-slate-100/50">
          <div className="flex items-center gap-3 bg-slate-50 hover:bg-white transition-colors px-4 py-2.5 rounded-2xl border border-slate-200 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100 w-96 shadow-sm">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input type="text" placeholder="Cari SKU atau nama barang..." className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 font-medium text-slate-700" />
            <kbd className="hidden md:inline-block text-[10px] font-mono font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">⌘K</kbd>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200"></div>

            {/* DROPDOWN USER */}
            <div className="relative">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setDropdownOpen(!dropdownOpen)}>
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold text-slate-700">{session ? session.nama : "Guest"}</p>
                  <p className="text-xs text-slate-500">{session ? ROLE_LABEL[session.role] || session.role : "..."}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-md hover:shadow-lg hover:ring-4 hover:ring-blue-100 transition-all text-white font-black text-sm">
                  {session ? session.nama.substring(0, 2).toUpperCase() : "??"}
                </div>
              </div>

              {dropdownOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl py-2 shadow-2xl shadow-slate-200/50 z-50 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-800 truncate">{session ? session.nama : "Guest"}</p>
                    <p className="text-xs text-slate-500 truncate">{session ? ROLE_LABEL[session.role] || session.role : "..."}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await logoutUser();
                      window.location.href = "/login";
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 font-bold hover:bg-red-50 transition-colors mt-1"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
          <div className="p-6 md:p-10 flex-1">
            {children}
          </div>

          <footer className="bg-gradient-to-r from-white via-slate-50/50 to-white border-t border-slate-200/60 text-slate-500 py-4 px-8 mt-auto flex flex-col sm:flex-row justify-between items-center gap-2">
            <p className="text-xs">© 2026 GudangSync V2. All rights reserved.</p>
            <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              BCA Syariah — Logistik & Asset
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}