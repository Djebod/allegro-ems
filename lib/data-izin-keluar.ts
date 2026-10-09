"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { dbClient } from "@/lib/firebase";
import { durasiMenit, lebihDuaJam } from "@/lib/izin-keluar";
import { jamServer, selisihJamPerangkatDetik } from "@/lib/jam-server";
import type { Employee, IzinKeluar, KeperluanIzinKeluar, SesiIzinKeluar } from "@/types";

const KOLEKSI = "izinKeluar";

function keIzin(id: string, data: unknown): IzinKeluar {
  return { id, ...(data as Omit<IzinKeluar, "id">) };
}

const urutBaru = (a: IzinKeluar, b: IzinKeluar) =>
  b.tanggal.localeCompare(a.tanggal) || (b.rencanaKeluar || "").localeCompare(a.rencanaKeluar || "");

/** Izin milik satu karyawan. */
export function pantauIzinSaya(employeeId: string, setData: (d: IzinKeluar[]) => void, gagal: () => void) {
  return onSnapshot(
    query(collection(dbClient(), KOLEKSI), where("employeeId", "==", employeeId)),
    (snap) => setData(snap.docs.map((d) => keIzin(d.id, d.data())).sort(urutBaru)),
    gagal
  );
}

/** Semua izin dalam rentang tanggal, untuk HR/Owner. */
export function pantauIzinRentang(
  dari: string,
  sampai: string,
  setData: (d: IzinKeluar[]) => void,
  gagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), KOLEKSI), where("tanggal", ">=", dari), where("tanggal", "<=", sampai)),
    (snap) => setData(snap.docs.map((d) => keIzin(d.id, d.data())).sort(urutBaru)),
    gagal
  );
}

/** Izin yang masih menunggu keputusan, berapa pun tanggalnya. */
export function pantauIzinMenunggu(setData: (d: IzinKeluar[]) => void, gagal: () => void) {
  return onSnapshot(
    query(collection(dbClient(), KOLEKSI), where("status", "==", "MENUNGGU")),
    (snap) => setData(snap.docs.map((d) => keIzin(d.id, d.data())).sort(urutBaru)),
    gagal
  );
}

export async function ajukanIzinKeluar(opsi: {
  karyawan: Employee;
  tanggal: string;
  keperluan: KeperluanIzinKeluar;
  alasan: string;
  rencanaKeluar: string;
}) {
  if (!opsi.alasan.trim()) throw new Error("Alasan meninggalkan kantor wajib diisi.");
  if (!/^\d{2}:\d{2}$/.test(opsi.rencanaKeluar)) throw new Error("Jam keluar belum diisi.");
  const ref = await addDoc(collection(dbClient(), KOLEKSI), {
    employeeId: opsi.karyawan.id,
    employeeName: opsi.karyawan.name,
    divisi: opsi.karyawan.divisi || "",
    atasanId: opsi.karyawan.atasanId || "",
    tanggal: opsi.tanggal,
    keperluan: opsi.keperluan,
    alasan: opsi.alasan.trim(),
    rencanaKeluar: opsi.rencanaKeluar,
    keluar: null,
    kembali: null,
    durasiMenit: null,
    lebihDuaJam: false,
    status: "MENUNGGU",
    diketahuiOleh: null,
    diputuskanOleh: null,
    catatanKeputusan: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Karyawan mencatat keluar atau kembali, dengan swafoto dan GPS. */
export async function catatSesiIzin(
  izin: IzinKeluar,
  jenis: "keluar" | "kembali",
  titik: Omit<SesiIzinKeluar, "waktu" | "recordedAt" | "selisihJamPerangkatDetik">
) {
  const ref = doc(dbClient(), KOLEKSI, izin.id);
  const kini = (await getDoc(ref)).data() as IzinKeluar | undefined;
  if (!kini) throw new Error("Izin tidak ditemukan.");
  if (kini.status === "DITOLAK" || kini.status === "DIBATALKAN") throw new Error("Izin ini sudah tidak berlaku.");
  if (jenis === "keluar" && kini.keluar) throw new Error("Jam keluar sudah tercatat.");
  if (jenis === "kembali" && !kini.keluar) throw new Error("Catat keluar kantor dulu.");
  if (jenis === "kembali" && kini.kembali) throw new Error("Jam kembali sudah tercatat.");

  // Jam dari server, bukan perangkat: lama di luar kantor dihitung dari
  // dua jam ini, jadi keduanya tidak boleh bisa diatur dari jam HP.
  const jamKini = await jamServer();
  const sesi = {
    ...titik,
    waktu: jamKini.toISOString(),
    recordedAt: serverTimestamp(),
    selisihJamPerangkatDetik: selisihJamPerangkatDetik(jamKini),
  };

  if (jenis === "keluar") {
    await updateDoc(ref, { keluar: sesi, updatedAt: serverTimestamp() });
    return;
  }
  const menit = durasiMenit(kini.keluar!.waktu, sesi.waktu);
  await updateDoc(ref, {
    kembali: sesi,
    durasiMenit: menit,
    lebihDuaJam: lebihDuaJam(kini.keperluan, menit),
    updatedAt: serverTimestamp(),
  });
}

export async function batalkanIzinKeluar(izin: IzinKeluar) {
  if (izin.status !== "MENUNGGU" || izin.keluar) {
    throw new Error("Hanya izin yang belum diputuskan dan belum dipakai keluar yang bisa dibatalkan.");
  }
  await updateDoc(doc(dbClient(), KOLEKSI, izin.id), { status: "DIBATALKAN", updatedAt: serverTimestamp() });
}

/** HR menandai "Diketahui". */
export async function ketahuiIzinKeluar(izin: IzinKeluar, oleh: string) {
  await updateDoc(doc(dbClient(), KOLEKSI, izin.id), {
    diketahuiOleh: oleh,
    diketahuiPada: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Owner menyetujui atau menolak. */
export async function putuskanIzinKeluar(izin: IzinKeluar, hasil: "DISETUJUI" | "DITOLAK", catatan: string, oleh: string) {
  if (hasil === "DITOLAK" && !catatan.trim()) throw new Error("Alasan penolakan wajib diisi.");
  await updateDoc(doc(dbClient(), KOLEKSI, izin.id), {
    status: hasil,
    diputuskanOleh: oleh,
    diputuskanPada: serverTimestamp(),
    catatanKeputusan: catatan.trim(),
    updatedAt: serverTimestamp(),
  });
}
