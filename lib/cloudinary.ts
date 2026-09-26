"use client";

import { MAX_PHOTO_SIZE_BYTE } from "@/lib/constants";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";

export function cloudinarySiap(): boolean {
  return CLOUD.length > 0 && PRESET.length > 0;
}

/**
 * Foto dari kamera HP bisa 3-5 MB. Dikecilkan dulu di browser supaya
 * hemat kuota Cloudinary dan cepat terkirim di sinyal lapangan.
 * Sisi terpanjang dibatasi 1280 px, lalu mutunya diturunkan bertahap
 * sampai ukurannya di bawah batas.
 */
export async function kecilkanFoto(file: File): Promise<Blob> {
  const gambar = await new Promise<HTMLImageElement>((selesai, gagal) => {
    const img = new Image();
    img.onload = () => selesai(img);
    img.onerror = () => gagal(new Error("Berkas ini bukan gambar yang bisa dibaca."));
    img.src = URL.createObjectURL(file);
  });

  const maksSisi = 1280;
  const skala = Math.min(1, maksSisi / Math.max(gambar.width, gambar.height));
  const kanvas = document.createElement("canvas");
  kanvas.width = Math.round(gambar.width * skala);
  kanvas.height = Math.round(gambar.height * skala);

  const ctx = kanvas.getContext("2d");
  if (!ctx) throw new Error("Browser ini tidak bisa memproses gambar.");
  ctx.drawImage(gambar, 0, 0, kanvas.width, kanvas.height);
  URL.revokeObjectURL(gambar.src);

  let mutu = 0.8;
  let hasil = await keBlob(kanvas, mutu);
  while (hasil.size > MAX_PHOTO_SIZE_BYTE && mutu > 0.4) {
    mutu -= 0.1;
    hasil = await keBlob(kanvas, mutu);
  }
  return hasil;
}

function keBlob(kanvas: HTMLCanvasElement, mutu: number): Promise<Blob> {
  return new Promise((selesai, gagal) =>
    kanvas.toBlob(
      (b) => (b ? selesai(b) : gagal(new Error("Gambar gagal diproses."))),
      "image/jpeg",
      mutu
    )
  );
}

export interface HasilUnggah {
  url: string;
  publicId: string;
}

/**
 * Nama berkas sengaja diacak, bukan memakai NIK atau nama orang.
 * Tautan Cloudinary bisa dibuka siapa saja yang tahu alamatnya, jadi
 * alamat yang tidak bisa ditebak adalah lapisan perlindungan pertama.
 */
export async function unggahFoto(file: File, folder: string): Promise<HasilUnggah> {
  if (!cloudinarySiap()) {
    throw new Error(
      "Cloudinary belum diatur. Isi NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME dan NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET."
    );
  }

  const kecil = await kecilkanFoto(file);
  const acak =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const data = new FormData();
  data.append("file", kecil);
  data.append("upload_preset", PRESET);
  data.append("folder", folder);
  data.append("public_id", acak);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: "POST",
    body: data,
  });

  if (!res.ok) {
    const isi = await res.json().catch(() => null);
    const sebab = isi?.error?.message || "";
    throw new Error(
      sebab.includes("preset")
        ? "Upload preset Cloudinary tidak ditemukan atau belum disetel Unsigned."
        : `Foto gagal diunggah. ${sebab}`.trim()
    );
  }

  const isi = await res.json();
  return { url: isi.secure_url as string, publicId: isi.public_id as string };
}

export const FOLDER_PROFIL = "allegro/profil";
export const FOLDER_KTP = "allegro/ktp";
export const FOLDER_ABSENSI = "allegro/absensi";

/**
 * Mengubah tautan Cloudinary menjadi versi kecil yang dipotong persegi.
 * Daftar karyawan bisa berisi puluhan foto; memuat gambar ukuran penuh
 * di sana boros kuota dan lambat di jaringan lapangan.
 */
export function fotoKecil(url: string | null | undefined, px = 96): string {
  if (!url) return "";
  const tanda = "/upload/";
  const posisi = url.indexOf(tanda);
  if (posisi === -1) return url;
  const ubah = `c_fill,g_face,w_${px},h_${px},q_auto,f_auto/`;
  return url.slice(0, posisi + tanda.length) + ubah + url.slice(posisi + tanda.length);
}
