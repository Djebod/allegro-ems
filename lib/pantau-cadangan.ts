"use client";

import { onSnapshot, type DocumentData, type FirestoreError, type Query } from "firebase/firestore";

/**
 * Query gabungan "kolom A sama dengan X DAN tanggal di antara ..." butuh
 * composite index di Firestore. Kalau index-nya belum dibuat, Firestore
 * MENOLAK query itu (failed-precondition) - dan tampilan diam-diam kosong.
 * Pernah terjadi 30 Sep 2026: beranda menampilkan "belum absen" padahal
 * sudah absen.
 *
 * Pembungkus ini mencoba query utama dulu. Kalau ditolak karena index
 * belum ada, ia pindah ke query cadangan yang hanya memakai satu kolom
 * (selalu punya index otomatis) lalu menyaring tanggalnya di sini.
 * Begitu index dibuat, query utama yang dipakai lagi dengan sendirinya.
 */
export function pantauDenganCadangan<T>(opsi: {
  utama: Query<DocumentData>;
  cadangan: Query<DocumentData>;
  ubah: (id: string, data: DocumentData) => T;
  saring: (x: T) => boolean;
  onData: (d: T[]) => void;
  onGagal: (e?: FirestoreError) => void;
}) {
  let lepas = () => {};
  let berhenti = false;

  const pakai = (q: Query<DocumentData>, disaring: boolean) =>
    onSnapshot(
      q,
      (snap) => {
        const isi = snap.docs.map((d) => opsi.ubah(d.id, d.data()));
        opsi.onData(disaring ? isi.filter(opsi.saring) : isi);
      },
      (e) => {
        if (!disaring && e.code === "failed-precondition" && !berhenti) {
          // Pesan aslinya memuat tautan untuk membuat index di Firebase Console.
          console.warn("[Allegro EMS] Index Firestore belum dibuat, memakai query cadangan.", e.message);
          lepas();
          lepas = pakai(opsi.cadangan, true);
          return;
        }
        opsi.onGagal(e);
      }
    );

  lepas = pakai(opsi.utama, false);
  return () => {
    berhenti = true;
    lepas();
  };
}
