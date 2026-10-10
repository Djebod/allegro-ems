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
/** Ambang keyakinan deteksi wajah; foto KTP buram butuh ambang rendah. */
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
 * menyamakan format (KTP kadang PNG).
 */
function fotoUntukDeteksi(url: string): string {
  const tanda = "/upload/";
  const i = url.indexOf(tanda);
  if (i === -1) return url;
  return url.slice(0, i + tanda.length) + "c_limit,w_800,h_800,q_auto,f_jpg/" + url.slice(i + tanda.length);
}

/** Sidik wajah (128 angka) dari satu foto; null bila tidak ada wajah terdeteksi. */
export function sidikWajah(url: string): Promise<Float32Array | null> {
  let p = sidikTersimpan.get(url);
  if (!p) {
    p = (async () => {
      const api = await muatModul();
      const gambar = await api.fetchImage(fotoUntukDeteksi(url));
      const hasil = await api
        .detectSingleFace(
          gambar,
          new api.TinyFaceDetectorOptions({ inputSize: UKURAN_MASUKAN, scoreThreshold: AMBANG_DETEKSI })
        )
        .withFaceLandmarks(true)
        .withFaceDescriptor();
      return hasil ? hasil.descriptor : null;
    })();
    sidikTersimpan.set(url, p);
    // Gagal jaringan jangan diingat; biarkan dicoba lagi.
    p.catch(() => sidikTersimpan.delete(url));
  }
  return p;
}

export type HasilBanding = { jarak: number } | { gagal: "ABSEN" | "KTP" };

/** Membandingkan foto absen dengan foto KTP. Jarak kecil = mirip. */
export async function bandingkanWajah(urlAbsen: string, urlKtp: string): Promise<HasilBanding> {
  const [absen, ktp] = await Promise.all([sidikWajah(urlAbsen), sidikWajah(urlKtp)]);
  if (!ktp) return { gagal: "KTP" };
  if (!absen) return { gagal: "ABSEN" };
  return { jarak: jarakSidik(absen, ktp) };
}
