"use server";

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

// Bikin secret key (Paling aman ditaruh di .env nantinya)
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "wms-bcas-super-secret-key-yang-susah-ditebak"
);

export async function loginUser(formData: FormData) {
  try {
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    // --- FITUR AUTO-SEED ---
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

    // --- BIKIN JWT TOKEN YANG AMAN ---
    const token = await new SignJWT({ id: user.id, nama: user.nama, role: user.role })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h") // Berlaku 24 jam
      .sign(SECRET_KEY);

    // Set Session Cookie
    (await cookies()).set("wms_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, 
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

// Fungsi untuk baca session (sekarang harus di-decrypt dulu)
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("wms_session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload; // Isinya: id, nama, role
  } catch (error) {
    return null; // Kalau token udah expired / ga valid
  }
}