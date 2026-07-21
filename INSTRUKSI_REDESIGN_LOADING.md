# INSTRUKSI — Redesign Loading Skeleton (Shimmer + Mirror Layout)

> Untuk Claude Code. Mengganti skeleton generik abu-abu jadi skeleton yang (a) pakai efek shimmer premium, (b) mirror struktur halaman asli (KPI strip + glass panel + tabel) supaya transisi loading → konten mulus tanpa layout jump, (c) konsisten dengan design system (slate + glass, TANPA `dark:` variant).

## File yang disentuh
1. `src/components/skeletons.tsx` — rewrite komponen
2. `src/app/globals.css` — tambah keyframes shimmer
3. `src/app/loading.tsx` — tetap, hanya pastikan masih import `PageSkeleton`

JANGAN sentuh file lain.

## 1. Keyframes shimmer di `globals.css`

Tambahkan:

```css
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}

@utility skeleton-shimmer {
  background: linear-gradient(90deg, rgb(226 232 240 / 0.6) 25%, rgb(241 245 249 / 0.9) 50%, rgb(226 232 240 / 0.6) 75%);
  background-size: 800px 100%;
  animation: shimmer 1.6s ease-in-out infinite;
  border-radius: 0.5rem;
}
```

Catatan: proyek ini pakai Tailwind v4 dengan syntax `@utility` (lihat `glass-panel` existing sebagai contoh) — ikuti pola yang sama.

## 2. Rewrite `src/components/skeletons.tsx`

Ganti seluruh isi file dengan komponen-komponen berikut. Hapus SEMUA `dark:` class dan warna `gray-*` — ganti `slate-*` + shimmer.

```tsx
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
    <div className="w-full space-y-6 animate-in fade-in duration-300">
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
```

Detail penting:
- `style={{ opacity: 1 - i * 0.1 }}` di baris tabel = efek fade bertingkat ke bawah — memberi kesan "konten sedang mengalir masuk", jauh lebih hidup daripada semua baris sama rata.
- Kalau `animate-in fade-in` (tailwindcss-animate) tidak tersedia di proyek, ganti wrapper `PageSkeleton` jadi tanpa animasi atau pakai keyframes fadeIn yang sudah ditambahkan di instruksi shell sebelumnya.
- `KpiStripSkeleton` dan `TablePanelSkeleton` di-export supaya nanti bisa dipakai granular per-halaman kalau mau (misal `loading.tsx` per route), tapi JANGAN buat loading.tsx per-route sekarang — cukup global.

## 3. Verifikasi

```bash
npm run build
```
Lolos. Lalu manual:
- [ ] Hard-refresh `/inventory` atau `/master` (Ctrl+Shift+R) → skeleton muncul sekejap dengan efek shimmer bergerak kiri-ke-kanan (bukan pulse kedip statis)
- [ ] Bentuk skeleton nyerupai halaman asli: 4 kartu KPI di atas, panel dengan header + baris tabel — begitu konten asli muncul, tidak ada lompatan layout besar
- [ ] Baris tabel skeleton makin ke bawah makin pudar (fade bertingkat)
- [ ] Tidak ada warna gelap/abu tua tersisa (bekas `dark:` sudah bersih)
- [ ] Cek juga navigasi antar halaman via sidebar — skeleton tampil saat pindah route

## Commit
Pesan: `feat(ui): redesign loading skeleton shimmer + mirror layout`
