"use client";

import { jarakSidik } from "@/lib/wajah";

/*
 * Pembanding wajah berjalan SEPENUHNYA di browser Admin (paket Spark, tanpa
 * server). Model face-api (~6,7 MB) dimuat sekali saat tombol pertama
 * ditekan, bukan saat halaman dibuka, supaya halaman absensi tetap ringan.
 * Berkas modelnya disalin dari node_modules/@vladmandic/face-api/model ke
 * public/model-wajah; kalau pustakanya dinaikkan versinya, salin ulang.
 */

type FaceApi = typeof import("@vladmandic/face-api/dist/face-api.esm.js");

export const LOKASI_MODEL = "/model-wajah";
/** Lebar gambar masukan pendeteksi, kelipatan 32. Lebih besar = lebih teliti, lebih lambat. */
const UKURAN_MASUKAN = 416;
/** Ambang keyakinan deteksi wajah; foto profil yang gelap atau jauh butuh ambang rendah. */
const AMBANG_DETEKSI = 0.3;

let pemuatan: Promise<FaceApi> | null = null;
const sidikTersimpan = new Map<string, Promise<Float32Array | null>>();

async function muatModul(): Promise<FaceApi> {
  if (!pemuatan) {
    pemuatan = (async () => {
      const api = await import("@vladmandic/face-api/dist/face-api.esm.js");
      // Backend TensorFlow.js (WebGL/CPU) disiapkan sendiri oleh face-api
      // saat model pertama dimuat; tidak perlu dipanggil terpisah.
      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(LOKASI_MODEL),
        api.nets.faceLandmark68TinyNet.loadFromUri(LOKASI_MODEL),
        api.nets.faceRecognitionNet.loadFromUri(LOKASI_MODEL),
      ]);
      return api;
    })().catch((e) => {
      pemuatan = null;
      throw e;
    });
  }
  return pemuatan;
}

/**
 * Tautan Cloudinary versi paling lebar 800 px tanpa dipotong. Foto asli
 * bisa beberapa MB; untuk mendeteksi wajah 800 px sudah cukup, dan f_jpg
 * menyamakan format (foto profil kadang PNG).
 */
function fotoUntukDeteksi(url: string): string {
  const tanda = "/upload/";
  const i = url.indexOf(tanda);
  if (i === -1) return url;
  return url.slice(0, i + tanda.length) + "c_limit,w_800,h_800,q_auto,f_jpg/" + url.slice(i + tanda.length);
}

/**
 * Potongan wajah yang dibuat Cloudinary sendiri (g_face, pendeteksi wajah di
 * server Cloudinary, termasuk paket gratis). Dipakai sebagai cadangan bila
 * wajah di foto utuh terlalu kecil atau terlalu gelap untuk model di browser.
 * Kalau Cloudinary pun tidak menemukan wajah, c_thumb memotong bagian tengah.
 */
function potonganWajahCloudinary(url: string): string | null {
  const tanda = "/upload/";
  const i = url.indexOf(tanda);
  if (i === -1) return null;
  return url.slice(0, i + tanda.length) + "c_thumb,g_face,z_0.7,w_480,h_480,q_auto,f_jpg/" + url.slice(i + tanda.length);
}

/** Tahapan deteksi, dari yang paling cepat ke yang paling gigih. */
const TAHAP_DETEKSI = [
  { ukuran: UKURAN_MASUKAN, ambang: AMBANG_DETEKSI },
  { ukuran: 608, ambang: 0.2 },
];

async function deteksiDariGambar(api: FaceApi, gambar: HTMLImageElement): Promise<Float32Array | null> {
  for (const t of TAHAP_DETEKSI) {
    const hasil = await api
      .detectSingleFace(gambar, new api.TinyFaceDetectorOptions({ inputSize: t.ukuran, scoreThreshold: t.ambang }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();
    if (hasil) return hasil.descriptor;
  }
  return null;
}

/** Sidik wajah (128 angka) dari satu foto; null bila tidak ada wajah terdeteksi. */
export function sidikWajah(url: string): Promise<Float32Array | null> {
  let p = sidikTersimpan.get(url);
  if (!p) {
    p = (async () => {
      const api = await muatModul();
      const utuh = await deteksiDariGambar(api, await api.fetchImage(fotoUntukDeteksi(url)));
      if (utuh) return utuh;
      // Cadangan: potongan wajah dari Cloudinary. Gagal mengambilnya bukan
      // galat; hasilnya sama saja dengan "tidak terdeteksi".
      const potongan = potonganWajahCloudinary(url);
      if (!potongan) return null;
      const gambar = await api.fetchImage(potongan).catch(() => null);
      return gambar ? deteksiDariGambar(api, gambar) : null;
    })();
    sidikTersimpan.set(url, p);
    // Gagal jaringan jangan diingat; biarkan dicoba lagi.
    p.catch(() => sidikTersimpan.delete(url));
  }
  return p;
}

export type FotoGagal = "ABSEN" | "PROFIL";
/** `gagal` berisi semua foto yang wajahnya tidak terdeteksi, bisa keduanya. */
export type HasilBanding = { jarak: number } | { gagal: FotoGagal[] };

/** Membandingkan foto absen dengan foto profil karyawan. Jarak kecil = mirip. */
export async function bandingkanWajah(urlAbsen: string, urlProfil: string): Promise<HasilBanding> {
  const [absen, profil] = await Promise.all([sidikWajah(urlAbsen), sidikWajah(urlProfil)]);
  const gagal: FotoGagal[] = [];
  if (!absen) gagal.push("ABSEN");
  if (!profil) gagal.push("PROFIL");
  if (gagal.length > 0 || !absen || !profil) return { gagal };
  return { jarak: jarakSidik(absen, profil) };
}
