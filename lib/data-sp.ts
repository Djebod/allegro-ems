"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { dbClient } from "@/lib/firebase";
import { idDrafSPOtomatis, masaBerlakuSampai } from "@/lib/sp";
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
      const isi = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<SuratPeringatan, "id">) }))
        .filter((sp) => !employeeId || sp.status !== "DRAFT");
      isi.sort((a, b) => b.tanggalTerbit.localeCompare(a.tanggalTerbit));
      onData(isi);
    },
    onGagal
  );
}

/** Kode karyawan yang draf SP otomatisnya untuk bulan itu sudah ada. */
export async function cekDrafSPOtomatis(employeeIds: string[], bulan: string): Promise<Set<string>> {
  const db = dbClient();
  const hasil = await Promise.all(
    employeeIds.map(async (id) => {
      const snap = await getDoc(doc(db, "warningLetters", idDrafSPOtomatis(id, bulan)));
      return snap.exists() ? id : null;
    })
  );
  return new Set(hasil.filter((id): id is string => id !== null));
}

/**
 * Draf SP 1 otomatis dari skor keterlambatan rekap bulanan. Sejak 15 Okt 2026
 * dibuat lewat tombol di Rekap bulanan (usul Bang Syam), bukan diam-diam saat
 * rekap dibuka: kegagalannya pernah tampil sebagai "data rekap tidak bisa
 * dibaca" dan membingungkan.
 *
 * Pemeriksaan dilakukan di sini lebih dulu supaya pesannya menyebut sebabnya:
 * rules warningLetters membaca dokumen karyawan (posisiKaryawan), dan kalau
 * dokumennya tidak ada, galat di rules hanya terbaca "insufficient permissions".
 * Baris rekap bisa berasal dari catatan absen yang karyawannya sudah dihapus.
 */
export async function buatDrafSPOtomatis(data: {
  employeeId: string;
  employeeName: string;
  divisi: string;
  bulan: string;
  tanggalTerbit: string;
  uraian: string;
  oleh: string;
}): Promise<"DIBUAT" | "SUDAH_ADA"> {
  const db = dbClient();
  const karyawan = await getDoc(doc(db, "employees", data.employeeId));
  if (!karyawan.exists()) {
    throw new Error(`Data karyawan ${data.employeeName} (${data.employeeId}) tidak ditemukan, jadi SP tidak bisa dibuat.`);
  }
  if (karyawan.data().position === "MANDOR") {
    throw new Error(`${data.employeeName} berposisi mandor; mandor tidak diberi surat peringatan.`);
  }

  // Kategori dibuat terpisah dari transaksi surat supaya kalau salah satu
  // ditolak rules, jelas yang mana.
  const kategoriRef = doc(db, "spCategories", "KETERLAMBATAN");
  if (!(await getDoc(kategoriRef)).exists()) {
    await setDoc(kategoriRef, {
      nama: "Keterlambatan",
      aktif: true,
      dibuatOleh: data.oleh,
      createdAt: serverTimestamp(),
    });
  }

  const id = idDrafSPOtomatis(data.employeeId, data.bulan);
  const suratRef = doc(db, "warningLetters", id);
  let hasil: "DIBUAT" | "SUDAH_ADA" = "DIBUAT";
  // Transaksi menjaga draf yang sudah diterbitkan Owner tidak tertimpa
  // kembali menjadi DRAFT bila tombolnya ditekan dua kali.
  await runTransaction(db, async (transaksi) => {
    const surat = await transaksi.get(suratRef);
    if (surat.exists()) {
      hasil = "SUDAH_ADA";
      return;
    }
    transaksi.set(suratRef, {
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      divisi: data.divisi,
      kategoriId: "KETERLAMBATAN",
      kategoriNama: "Keterlambatan",
      tingkat: 1,
      tanggalTerbit: data.tanggalTerbit,
      berlakuSampai: masaBerlakuSampai(data.tanggalTerbit),
      uraian: data.uraian,
      lampiranUrl: null,
      status: "DRAFT",
      bulanPemicu: data.bulan,
      dicabut: false,
      alasanPencabutan: "",
      diterbitkanOleh: data.oleh,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return hasil;
}

export async function terbitkanDrafSP(id: string, tanggalTerbit: string, oleh: string) {
  await updateDoc(doc(dbClient(), "warningLetters", id), {
    status: "TERBIT",
    tanggalTerbit,
    berlakuSampai: masaBerlakuSampai(tanggalTerbit),
    diterbitkanOleh: oleh,
    updatedAt: serverTimestamp(),
  });
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
    status: "DRAFT",
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
