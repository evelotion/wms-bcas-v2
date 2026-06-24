// src/app/(dashboard)/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Karena Sidebar & Header udah ada di Root Layout (src/app/layout.tsx),
  // di sini kita cukup nge-pass/meneruskan konten children-nya aja.
  return <>{children}</>;
}