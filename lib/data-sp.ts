"use client";

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { dbClient } from "@/lib/firebase";
import { masaBerlakuSampai } from "@/lib/sp";
import type { KategoriSP, SuratPeringatan, TingkatSP } from "@/types";

/* ---------------- Kategori ---------------- */

export function pantauKategoriSP(
  onData: (data: KategoriSP[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    collection(dbClient(), "spCategories"),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<KategoriSP, "id">) }));
      isi.sort((a, b) => a.nama.localeCompare(b.nama));
      onData(isi);
    },
    onGagal
  );
}

/** Nama dirapikan jadi ID, supaya satu kategori tidak lahir dua kali. */
export function idKategori(nama: string): string {
  return nama
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function tambahKategoriSP(nama: string, oleh: string) {
  const id = idKategori(nama);
  if (!id) throw new Error("Nama kategori wajib diisi.");
  const ref = doc(dbClient(), "spCategories", id);
  const ada = await getDocs(
    query(collection(dbClient(), "spCategories"), where("nama", "==", nama.trim()))
  );
  if (!ada.empty) throw new Error(`Kategori "${nama.trim()}" sudah ada.`);
  await setDoc(ref, {
    nama: nama.trim(),
    aktif: true,
    dibuatOleh: oleh,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function ubahKategoriSP(id: string, aktif: boolean) {
  await updateDoc(doc(dbClient(), "spCategories", id), { aktif });
}

/* ---------------- Surat peringatan ---------------- */

export function pantauSP(
  onData: (data: SuratPeringatan[]) => void,
  onGagal: () => void,
  employeeId?: string
) {
  const dasar = collection(dbClient(), "warningLetters");
  const q = employeeId ? query(dasar, where("employeeId", "==", employeeId)) : query(dasar);

  return onSnapshot(
    q,
    (snap) => {
      const isi = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SuratPeringatan, "id">),
      }));
      isi.sort((a, b) => b.tanggalTerbit.localeCompare(a.tanggalTerbit));
      onData(isi);
    },
    onGagal
  );
}

export async function terbitkanSP(data: {
  employeeId: string;
  employeeName: string;
  divisi: string;
  kategoriId: string;
  kategoriNama: string;
  tingkat: TingkatSP;
  tanggalTerbit: string;
  uraian: string;
  lampiranUrl: string | null;
  oleh: string;
}) {
  if (!data.uraian.trim()) throw new Error("Uraian masalah wajib diisi.");

  const ref = doc(collection(dbClient(), "warningLetters"));
  await setDoc(ref, {
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    divisi: data.divisi,
    kategoriId: data.kategoriId,
    kategoriNama: data.kategoriNama,
    tingkat: data.tingkat,
    tanggalTerbit: data.tanggalTerbit,
    berlakuSampai: masaBerlakuSampai(data.tanggalTerbit),
    uraian: data.uraian.trim(),
    lampiranUrl: data.lampiranUrl,
    dicabut: false,
    alasanPencabutan: "",
    diterbitkanOleh: data.oleh,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Mencabut SP sebelum masa berlakunya habis. Suratnya tidak dihapus —
 * jejaknya tetap ada berikut alasan pencabutannya, tetapi tidak lagi
 * menaikkan tingkat SP berikutnya.
 */
export async function cabutSP(id: string, alasan: string, oleh: string) {
  if (!alasan.trim()) throw new Error("Alasan pencabutan wajib diisi.");
  await updateDoc(doc(dbClient(), "warningLetters", id), {
    dicabut: true,
    alasanPencabutan: `${alasan.trim()} — dicabut oleh ${oleh}`,
    updatedAt: serverTimestamp(),
  });
}
