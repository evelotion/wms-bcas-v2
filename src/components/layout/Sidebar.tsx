import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    { name: "Dashboard", path: "/" },
    { name: "Master Barang", path: "/master" },
    { name: "Inbound (Masuk)", path: "/inbound" },
    { name: "Requisition", path: "/permintaan" },
    { name: "Outstanding", path: "/outstanding" }, // Terpisah di sini
    { name: "Manajemen Rak", path: "/rak" },
  ];

  return (
    <aside className="glass-panel hidden w-64 flex-col justify-between p-4 sm:flex h-full border-r border-white/40">
      <div>
        <div className="mb-8 px-4">
          <h1 className="text-2xl font-black tracking-tight text-blue-900">
            BCA<span className="text-blue-600">Syariah</span>
          </h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Logistik & Asset</p>
        </div>
        
        <nav className="flex flex-col gap-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
            return (
              <Link 
                key={item.name} 
                href={item.path}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold" 
                    : "text-slate-600 hover:bg-white/50 hover:text-blue-700 hover:shadow-sm"
                }`}
              >
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-4 text-xs text-slate-400 text-center">
        v2.1.0 (FIFO Ledger)
      </div>
    </aside>
  );
}