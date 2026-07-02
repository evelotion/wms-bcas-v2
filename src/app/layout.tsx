import { Inter } from "next/font/google";
import "./globals.css";
import { getSession } from "@/app/login/actions"; 
import ClientAppShell from "@/components/layout/ClientAppShell"; // Kita bikin ini di bawah

const inter = Inter({ subsets: ["latin"] });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 1. Ambil session langsung di Server! (Tidak ada lagi efek loading berkedip)
  const session = await getSession();

  return (
    <html lang="id">
      <body className={`${inter.className} flex h-screen overflow-hidden antialiased bg-slate-50`}>
        {/* 2. Oper data session dan children ke Client Component pembungkus */}
        <ClientAppShell session={session}>
          {children}
        </ClientAppShell>
      </body>
    </html>
  );
}