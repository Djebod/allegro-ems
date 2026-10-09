"use client";

import { FOLDER_TANDA_TANGAN, unggahFoto } from "@/lib/cloudinary";
import type { TandaTangan } from "@/types";

/**
 * Mengunggah gambar tanda tangan yang baru digoreskan di layar, lalu
 * membungkusnya bersama nama penandatangan. Dipakai setiap kali Admin
 * merevisi absen: tanpa tanda tangan, revisinya tidak diterima.
 */
export async function unggahTandaTangan(
  berkas: File,
  penanda: { nama: string; email: string }
): Promise<TandaTangan> {
  const hasil = await unggahFoto(berkas, FOLDER_TANDA_TANGAN);
  return { url: hasil.url, nama: penanda.nama, email: penanda.email };
}
