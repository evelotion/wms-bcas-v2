"use server";

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function loginUser(formData: FormData) {
  try {
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    // --- FITUR AUTO-SEED ---
    // Buatin 2 akun otomatis sesuai Schema baru kalau DB masih kosong
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      await prisma.user.create({
        data: { username: "admin", password: "123", nama: "Staf Admin", role: "ADMIN" }
      });
      await prisma.user.create({
        data: { username: "gudang", password: "123", nama: "Staf Gudang", role: "GUDANG" }
      });
    }

    // Cari User
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.password !== password) {
      return { success: false, error: "Username atau password salah!" };
    }

    // Set Session Cookie (Berlaku 1 hari)
    const sessionData = JSON.stringify({ id: user.id, nama: user.nama, role: user.role });
    (await cookies()).set("wms_session", sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 24 jam
      path: "/",
    });

    return { success: true };
  } catch (error) {
    console.error("Login Error:", error);
    return { success: false, error: "Terjadi kesalahan sistem." };
  }
}

export async function logoutUser() {
  (await cookies()).delete("wms_session");
  return { success: true };
}

// Tambahan: Fungsi untuk baca session di Client Component
export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("wms_session")?.value;
  if (!session) return null;
  return JSON.parse(session);
}