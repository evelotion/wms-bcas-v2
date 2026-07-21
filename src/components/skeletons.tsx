// Blok dasar shimmer — semua skeleton dibangun dari ini
function Bone({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer ${className}`} />;
}

// KPI strip skeleton — mirror grid 4 kartu di halaman asli
export function KpiStripSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <Bone className="w-11 h-11 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-3 w-20" />
            <Bone className="h-6 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Panel tabel skeleton — mirror header (judul+chips+search) + baris tabel
export function TablePanelSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      {/* Header: judul + chips + search */}
      <div className="p-5 border-b border-slate-200/60 bg-white/40 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        <Bone className="h-6 w-40" />
        <div className="flex gap-3 items-center">
          <div className="flex gap-1.5 p-1 bg-slate-100/50 rounded-xl">
            {[...Array(4)].map((_, i) => <Bone key={i} className="h-7 w-16 rounded-lg" />)}
          </div>
          <Bone className="h-10 w-64 rounded-xl" />
        </div>
      </div>
      {/* Baris tabel */}
      <div className="divide-y divide-slate-100/60">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-6" style={{ opacity: 1 - i * 0.1 }}>
            <Bone className="w-5 h-5 rounded" />
            <div className="flex-1 space-y-2">
              <Bone className="h-4 w-2/5" />
              <Bone className="h-3 w-1/4" />
            </div>
            <Bone className="h-4 w-20" />
            <Bone className="h-4 w-24" />
            <Bone className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
      {/* Footer pagination */}
      <div className="p-4 border-t border-slate-200/60 bg-white/40 flex justify-between items-center">
        <Bone className="h-4 w-48" />
        <div className="flex gap-2">
          <Bone className="h-9 w-9 rounded-xl" />
          <Bone className="h-9 w-20 rounded-xl" />
          <Bone className="h-9 w-9 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// Skeleton halaman penuh — dipakai loading.tsx global
export function PageSkeleton() {
  return (
    <div className="w-full p-6 space-y-6 animate-fade-in">
      {/* Judul halaman */}
      <div className="space-y-2">
        <Bone className="h-7 w-56" />
        <Bone className="h-4 w-80" />
      </div>
      <KpiStripSkeleton />
      <TablePanelSkeleton />
    </div>
  );
}
