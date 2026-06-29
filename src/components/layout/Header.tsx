export default function Header() {
  return (
    <header className="glass-panel sticky top-0 z-50 flex h-16 w-full items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-slate-800">GudangSync V2</h2>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          Online
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-slate-700">IND</p>
          <p className="text-xs text-slate-500">Super Admin</p>
        </div>
        <div className="h-10 w-10 rounded-full bg-blue-600 border-2 border-white shadow-sm flex items-center justify-center text-white font-bold">
          I
        </div>
      </div>
    </header>
  );
}
