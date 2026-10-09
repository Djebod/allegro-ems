"use client";

import { BATAS_UNGGAH_FOTO_MS, MAX_PHOTO_SIZE_BYTE, ULANG_UNGGAH_FOTO } from "@/lib/constants";

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

  const maksSisi = 960;

  // Kalau berkas sudah di bawah batas ukuran dan dimensinya sudah pas
  // (misal jepretan KameraBelakang yang sudah diatur ke 800 px),
  // langsung pakai berkas aslinya — hindari kompresi ganda yang membuang waktu.
  if (
    file.size <= MAX_PHOTO_SIZE_BYTE &&
    gambar.width <= maksSisi &&
    gambar.height <= maksSisi
  ) {
    URL.revokeObjectURL(gambar.src);
    return file;
  }

  const skala = Math.min(1, maksSisi / Math.max(gambar.width, gambar.height));
  const kanvas = document.createElement("canvas");
  kanvas.width = Math.round(gambar.width * skala);
  kanvas.height = Math.round(gambar.height * skala);

  const ctx = kanvas.getContext("2d");
  if (!ctx) throw new Error("Browser ini tidak bisa memproses gambar.");
  ctx.drawImage(gambar, 0, 0, kanvas.width, kanvas.height);
  URL.revokeObjectURL(gambar.src);

  let mutu = 0.75;
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
export type TahapUnggah = "memproses" | "mengunggah" | "mengulang";

export async function unggahFoto(
  file: File,
  folder: string,
  onTahap?: (tahap: TahapUnggah) => void
): Promise<HasilUnggah> {
  if (!cloudinarySiap()) {
    throw new Error(
      "Cloudinary belum diatur. Isi NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME dan NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET."
    );
  }

  onTahap?.("memproses");
  const kecil = await kecilkanFoto(file);
  const acak =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Nama berkas sama di tiap percobaan, supaya kalau percobaan pertama
  // sebenarnya sampai di Cloudinary tetapi balasannya tidak kembali,
  // percobaan kedua menimpa berkas yang sama, bukan membuat foto kembar.
  for (let percobaan = 0; percobaan <= ULANG_UNGGAH_FOTO; percobaan++) {
    onTahap?.(percobaan === 0 ? "mengunggah" : "mengulang");
    try {
      return await kirimKeCloudinary(kecil, folder, acak);
    } catch (e) {
      // Galat dari Cloudinary sendiri (preset salah, berkas ditolak) tidak
      // akan berubah bila diulang; yang diulang hanya masalah koneksi.
      if (!(e instanceof GalatKoneksiUnggah)) throw e;
    }
  }
  // Pesan teknis browser ("Failed to fetch", "aborted") sengaja tidak
  // diteruskan; staf butuh tahu apa yang harus dilakukan, bukan sebabnya.
  throw new Error(
    "Foto tidak berhasil terkirim karena koneksi lambat atau terputus. Periksa sinyal, lalu ambil foto lagi."
  );
}

/** Masalah jaringan: batas waktu habis, fetch gagal tersambung, atau Cloudinary sedang terganggu. */
class GalatKoneksiUnggah extends Error {}

async function kirimKeCloudinary(kecil: Blob, folder: string, publicId: string): Promise<HasilUnggah> {
  const data = new FormData();
  data.append("file", kecil);
  data.append("upload_preset", PRESET);
  data.append("folder", folder);
  data.append("public_id", publicId);

  // Browser HP bisa menunggu bermenit-menit bila sinyal putus di tengah
  // unggah. AbortController memastikan tunggunya berhenti di batas yang
  // ditentukan, bukan sampai browser menyerah sendiri.
  const pembatal = new AbortController();
  const pengatur = setTimeout(() => pembatal.abort(), BATAS_UNGGAH_FOTO_MS);

  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
      method: "POST",
      body: data,
      signal: pembatal.signal,
    });
  } catch (e) {
    throw new GalatKoneksiUnggah(e instanceof Error ? e.message : "fetch gagal");
  } finally {
    clearTimeout(pengatur);
  }

  if (!res.ok) {
    const isi = await res.json().catch(() => null);
    const sebab = isi?.error?.message || "";
    // 5xx dan 429 adalah gangguan sementara di sisi Cloudinary; boleh diulang.
    if (res.status >= 500 || res.status === 429) throw new GalatKoneksiUnggah(sebab || `HTTP ${res.status}`);
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
export const FOLDER_TANDA_TANGAN = "allegro/tanda-tangan";
export const FOLDER_LEMBUR = "allegro/lembur";

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
