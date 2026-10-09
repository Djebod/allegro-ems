"use client";

import { Timestamp, doc, getDocFromServer, serverTimestamp, setDoc } from "firebase/firestore";
import { authClient, dbClient } from "@/lib/firebase";

/**
 * Jam menurut SERVER Firestore, bukan jam perangkat.
 *
 * Jam laptop atau HP bisa disetel bebas oleh pemakainya. Pernah dicoba
 * 9 Okt 2026: absen masuk jam 9, jam laptop dimundurkan ke jam 5, lalu
 * absen pulang diterima dengan jam 5. Tanpa Cloud Functions, satu-satunya
 * jam yang tidak bisa diutak-atik klien adalah jam server Firestore, dan
 * cara mendapatkannya: tulis serverTimestamp ke dokumen milik akun ini,
 * lalu baca kembali LANGSUNG dari server (bukan dari cache).
 *
 * Satu dokumen per akun di koleksi jamServer, ditimpa tiap kali dipanggil.
 * Nilainya dipakai untuk kolom waktu dan tanggal semua jalur absen, dan
 * rules memeriksa bahwa waktu yang disimpan memang tidak jauh dari jam
 * server saat ditulis (lihat waktuDekatJamServer di firestore.rules).
 */
export async function jamServer(): Promise<Date> {
  const uid = authClient().currentUser?.uid;
  if (!uid) throw new Error("Belum masuk. Muat ulang halaman lalu masuk lagi.");

  const ref = doc(dbClient(), "jamServer", uid);
  await setDoc(ref, { pada: serverTimestamp() });
  const snap = await getDocFromServer(ref);
  const pada = snap.get("pada");
  if (!(pada instanceof Timestamp)) {
    throw new Error("Jam server tidak terbaca. Periksa koneksi, lalu coba lagi.");
  }
  return pada.toDate();
}

/**
 * Selisih jam perangkat terhadap jam server, dalam detik (positif = jam
 * perangkat lebih maju). Disimpan di samping jam absen supaya Admin bisa
 * melihat perangkat siapa yang jamnya jauh menyimpang.
 */
export function selisihJamPerangkatDetik(jamServerKini: Date): number {
  return Math.round((Date.now() - jamServerKini.getTime()) / 1000);
}
