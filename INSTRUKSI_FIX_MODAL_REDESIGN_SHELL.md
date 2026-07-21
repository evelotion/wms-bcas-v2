# INSTRUKSI — Fix Modal + Redesign Shell (Sidebar & Navbar)

> Untuk Claude Code. Menutup 3 issue visual yang dilaporkan user: overlay modal terlalu gelap, sidebar/navbar tetap terang saat modal terbuka (z-index bug), dan sidebar/navbar sendiri kurang premium. Semua dalam satu commit karena semuanya nyentuh visual layer yang sama.

## File yang disentuh
1. `src/components/layout/ClientAppShell.tsx` — redesign sidebar & navbar + fix z-index
2. `src/app/master/page.tsx` — fix overlay modal
3. `src/app/globals.css` — kecil, tambah 1 utility & animation (optional)

Server actions, schema, dan semua halaman lain JANGAN disentuh.

---

## Fix 1 — Overlay Modal yang Bikin Modal Kelihatan Abu-abu

**File**: `src/app/master/page.tsx` line 283

**Akar masalah**: overlay pakai `bg-slate-900/40` (hitam 40%). Di atas glass-panel putih semi-transparan, ini bikin efek "muddy". Sistem visual proyek ini bright glassmorphism, jadi overlay-nya harus terang & lembut.

**Ganti**:
```tsx
<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
```
**Jadi**:
```tsx
<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/30 backdrop-blur-md">
```

Perubahan: dari hitam-40 ke putih-30, blur dari `sm` ke `md`. Ini bikin background page tetap terlihat samar (context preserved) tapi jelas jadi latar belakang. Modal akan terlihat "melayang" di atas layer buram, bukan di atas kegelapan.

---

## Fix 2 — Sidebar & Navbar Ikut Ter-Blur Saat Modal Terbuka (z-index)

**Akar masalah**: modal `z-[100]` render di dalam `<main>` (yang `z-10`). Sidebar `z-30` naik di atas modal-nya sendiri, jadi keliatan terang & clickable padahal modal aktif.

**Solusi paling clean**: portal modal ke `document.body` menggunakan React `createPortal`. Ini nyelesaiin masalah stacking context permanent, tidak cuma buat modal ini tapi buat semua modal masa depan (permintaan, inbound, dll).

**Di `src/app/master/page.tsx`**:
1. Tambah import: `import { createPortal } from "react-dom";` dan `import { useEffect, useState } from "react";` (useState sudah ada).
2. Tambah state di dekat state lain: `const [isMounted, setIsMounted] = useState(false); useEffect(() => setIsMounted(true), []);` — biar SSR-safe (portal cuma render setelah mounted).
3. Bungkus JSX modal dengan portal:
```tsx
{isModalOpen && isMounted && createPortal(
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/30 backdrop-blur-md">
    {/* ... isi modal existing ... */}
  </div>,
  document.body
)}
```

Portal ke body = modal jadi anak langsung body, keluar dari stacking context main. Sidebar/navbar dengan z-index apapun otomatis di bawahnya.

**Tidak perlu ubah z-index sidebar/navbar** — biarkan pattern existing (sidebar z-30, main z-10, header z-20). Portal-lah yang beresin masalah.

---

## Fix 3 — Redesign Sidebar (`ClientAppShell.tsx`)

**Prinsip**: naikkan premium tanpa merusak fungsi. Yang dipertahankan: struktur menu, filter role, logic active state, semua props & session handling.

Perubahan visual:

**A. Container sidebar** — ganti dari plain putih ke gradient halus + border yang lebih hidup:
```tsx
<aside className="w-64 hidden md:flex flex-col relative z-30 bg-gradient-to-b from-white via-white to-slate-50/80 border-r border-slate-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
```

**B. Logo section** — tambah gradient background halus:
```tsx
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
```

**C. Menu item** — item aktif dapat depth, item non-aktif dapat left border indicator saat hover:
```tsx
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
```

**D. Footer sidebar** (BARU) — tambah info user role kecil di bagian bawah sidebar sebelum `</aside>`:
```tsx
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
```

Nav container: pastikan `flex-1 overflow-y-auto` tetap (biar footer stick ke bawah).

---

## Fix 4 — Redesign Navbar (Header)

**Prinsip**: kurangin plain-ness, tambahin subtle glass + accent. Fungsi search & user dropdown dipertahankan.

**Container header** — ganti:
```tsx
<header className="h-20 glass-panel bg-white border-b border-slate-200 flex items-center justify-between px-8 z-20">
```
**Jadi**:
```tsx
<header className="h-20 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-8 z-20 shadow-sm shadow-slate-100/50">
```

**Search bar** — ganti pattern lama jadi lebih clean & prominent:
```tsx
<div className="flex items-center gap-3 bg-slate-50 hover:bg-white transition-colors px-4 py-2.5 rounded-2xl border border-slate-200 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100 w-96 shadow-sm">
  <Search size={16} className="text-slate-400 shrink-0" />
  <input type="text" placeholder="Cari SKU atau nama barang..." className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 font-medium text-slate-700" />
  <kbd className="hidden md:inline-block text-[10px] font-mono font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">⌘K</kbd>
</div>
```
(`⌘K` cuma dekorasi, belum functional — hanya kesan "modern app". Kalau nggak suka boleh dihapus.)

**Bell button** — kasih background pill supaya lebih clickable-looking:
```tsx
<button className="relative p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all">
  <Bell size={18} />
  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white"></span>
</button>
```
(Dot merah cuma indicator — nanti bisa dihubungin ke alert count real dari `getFpkbAlerts()`, tapi sekarang static aja.)

**User dropdown avatar** — pertahankan tapi tambah ring saat hover:
```tsx
<div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-md hover:shadow-lg hover:ring-4 hover:ring-blue-100 transition-all text-white font-black text-sm">
  {session ? session.nama.substring(0, 2).toUpperCase() : "??"}
</div>
```

**Dropdown menu** — pertahankan struktur, tambah header user info di dalam dropdown:
```tsx
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
```

**Footer** — kecil aja, tambah subtle gradient:
```tsx
<footer className="bg-gradient-to-r from-white via-slate-50/50 to-white border-t border-slate-200/60 text-slate-500 py-4 px-8 mt-auto flex flex-col sm:flex-row justify-between items-center gap-2">
  <p className="text-xs">© 2026 GudangSync V2. All rights reserved.</p>
  <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
    BCA Syariah — Logistik & Asset
  </p>
</footer>
```

---

## Fix 5 (Optional) — Animasi fade-in modal

Kalau di `globals.css` belum ada `@keyframes fade-in` & `zoom-in` (Tailwind `animate-in` biasanya butuh plugin `tailwindcss-animate`), cek dulu apakah animasi berjalan. Kalau tidak, tambahkan di globals:

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-modal-in {
  animation: fadeIn 200ms ease-out, zoomIn 200ms ease-out;
}
```
Lalu di modal `<div className="glass-panel ... animate-modal-in">`.

Kalau `tailwindcss-animate` sudah terpasang (`animate-in fade-in zoom-in` bekerja), skip step ini.

---

## Verifikasi

```bash
npm run build
```
Harus lolos.

Manual di `npm run dev`:
- [ ] Buka `/master` → klik Edit di baris manapun → modal muncul, overlay TERANG (bukan gelap), sidebar & navbar keliatan buram di belakang, tidak clickable
- [ ] Coba klik menu sidebar saat modal terbuka → tidak boleh navigate (klik ke overlay saja, atau kalau nggak sengaja klik sidebar seharusnya di-block karena z-index)
- [ ] Sidebar tampilan baru: logo lebih menonjol, active menu dengan indikator bar di kiri + gradient biru-indigo, footer user info di bawah
- [ ] Navbar: search bar lebih clean, bell dengan dot notifikasi, avatar rounded-2xl dengan shadow
- [ ] Cek tampilan `/inventory`, `/permintaan`, semua halaman lain tetap fine (nggak ada regression karena shell berubah)
- [ ] Klik avatar → dropdown user muncul dengan header nama+role di atas, tombol Logout di bawah

## Yang JANGAN dilakukan
- Jangan bikin dropdown notifikasi asli (bell) — cuma dot statik dulu
- Jangan hubungkan search di navbar ke logic apapun — cuma dekorasi (redesign fungsional nanti)
- Jangan sentuh menu items, filter role, path — struktur navigasi tetap
- Jangan ubah `globals.css` lebih dari yang disebut

## Commit
Pesan: `fix(ui): overlay modal + portal, redesign sidebar & navbar premium`
