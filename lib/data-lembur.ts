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
import { periksaPengajuanLembur, type JenisPengajuanLembur } from "@/lib/lembur";
import type { Employee, PengajuanLembur, StatusPengajuan } from "@/types";

const KOLEKSI = "overtimeRequests";

function keLembur(id: string, data: unknown): PengajuanLembur {
  return { id, ...(data as Omit<PengajuanLembur, "id">) };
}

const urutBaru = (a: PengajuanLembur, b: PengajuanLembur) =>
  b.tanggal.localeCompare(a.tanggal) || a.employeeName.localeCompare(b.employeeName);

/** Pengajuan lembur milik satu karyawan. */
export function pantauLemburSaya(employeeId: string, onData: (d: PengajuanLembur[]) => void, onGagal: () => void) {
  return onSnapshot(
    query(collection(dbClient(), KOLEKSI), where("employeeId", "==", employeeId)),
    (snap) => onData(snap.docs.map((d) => keLembur(d.id, d.data())).sort(urutBaru)),
    onGagal
  );
}

/** Pengajuan lembur seluruh anak buah seorang mandor. */
export function pantauLemburTim(mandorId: string, onData: (d: PengajuanLembur[]) => void, onGagal: () => void) {
  return onSnapshot(
    query(collection(dbClient(), KOLEKSI), where("mandorId", "==", mandorId)),
    (snap) => onData(snap.docs.map((d) => keLembur(d.id, d.data())).sort(urutBaru)),
    onGagal
  );
}

/** Semua pengajuan, untuk halaman kelola. Disaring status di sisi aplikasi. */
export function pantauSemuaLembur(onData: (d: PengajuanLembur[]) => void, onGagal: () => void) {
  return onSnapshot(
    collection(dbClient(), KOLEKSI),
    (snap) => onData(snap.docs.map((d) => keLembur(d.id, d.data())).sort(urutBaru)),
    onGagal
  );
}

/**
 * Pengajuan yang DISETUJUI dalam rentang tanggal, untuk mesin payroll.
 * Hanya tanggal yang disaring di query (satu kolom, tanpa composite index);
 * statusnya disaring di sini.
 */
export async function ambilLemburDisetujui(dari: string, sampai: string): Promise<PengajuanLembur[]> {
  const snap = await getDocs(
    query(collection(dbClient(), KOLEKSI), where("tanggal", ">=", dari), where("tanggal", "<=", sampai))
  );
  return snap.docs.map((d) => keLembur(d.id, d.data())).filter((p) => p.status === "DISETUJUI");
}

/**
 * Mengajukan pengakuan lembur. Selalu lahir berstatus DIAJUKAN - termasuk
 * bila yang mengajukan Admin atas nama karyawan - supaya tetap ada langkah
 * persetujuan yang terpisah dari langkah memasukkan datanya.
 */
export async function ajukanLembur(opsi: {
  karyawan: Employee;
  tanggal: string;
  hariIni: string;
  jamMulai: string;
  jamSelesai: string;
  alasan: string;
  lampiranUrl: string | null;
  sumber: PengajuanLembur["sumber"];
  oleh: string;
  /** Bawaan LEMBUR. MASUK_LIBUR wajib menyertakan tanggalLibur. */
  jenis?: JenisPengajuanLembur;
  tanggalLibur?: boolean;
}) {
  const jenis = opsi.jenis || "LEMBUR";
  const hasil = periksaPengajuanLembur({
    tanggal: opsi.tanggal,
    hariIni: opsi.hariIni,
    jamMulai: opsi.jamMulai,
    jamSelesai: opsi.jamSelesai,
    alasan: opsi.alasan,
    olehPengelola: opsi.sumber === "PENGELOLA",
    jenis,
    tanggalLibur: opsi.tanggalLibur,
    tanpaLembur: opsi.karyawan.tanpaLembur,
  });
  if (!hasil.boleh) throw new Error(hasil.alasan || "Pengajuan tidak bisa dikirim.");

  const ref = doc(collection(dbClient(), KOLEKSI));
  await setDoc(ref, {
    employeeId: opsi.karyawan.id,
    employeeName: opsi.karyawan.name,
    divisi: opsi.karyawan.divisi || "",
    atasanId: opsi.karyawan.atasanId || "",
    mandorId: opsi.karyawan.currentMandorId || "",
    jenis,
    tanggal: opsi.tanggal,
    jamMulai: opsi.jamMulai,
    jamSelesai: opsi.jamSelesai,
    jamLembur: hasil.jamLembur,
    alasan: opsi.alasan.trim(),
    lampiranUrl: opsi.lampiranUrl,
    terlambat: hasil.terlambat,
    sumber: opsi.sumber,
    status: "DIAJUKAN" as StatusPengajuan,
    diajukanOleh: opsi.oleh,
    diputuskanOleh: null,
    catatanKeputusan: "",
    jamDisetujui: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** HR/Owner/Admin memutuskan. Jam yang disetujui boleh dikurangi dari yang diminta. */
export async function putuskanLembur(opsi: {
  pengajuan: PengajuanLembur;
  status: Extract<StatusPengajuan, "DISETUJUI" | "DITOLAK">;
  catatan: string;
  jamDisetujui: number;
  oleh: string;
}) {
  if (opsi.pengajuan.status !== "DIAJUKAN") throw new Error("Pengajuan ini sudah diputuskan.");
  if (opsi.status === "DITOLAK" && !opsi.catatan.trim()) throw new Error("Alasan penolakan wajib diisi.");
  if (opsi.status === "DISETUJUI") {
    if (!(opsi.jamDisetujui > 0)) throw new Error("Jam yang disetujui harus lebih dari nol.");
    if (opsi.jamDisetujui > opsi.pengajuan.jamLembur) {
      throw new Error("Jam yang disetujui tidak boleh lebih besar dari yang diajukan.");
    }
  }
  await updateDoc(doc(dbClient(), KOLEKSI, opsi.pengajuan.id), {
    status: opsi.status,
    catatanKeputusan: opsi.catatan.trim(),
    diputuskanOleh: opsi.oleh,
    jamDisetujui: opsi.status === "DISETUJUI" ? Math.round(opsi.jamDisetujui * 100) / 100 : null,
    updatedAt: serverTimestamp(),
  });
}

/** Pemilik membatalkan pengajuannya yang belum diputuskan. */
export async function batalkanLembur(pengajuan: PengajuanLembur, oleh: string) {
  if (pengajuan.status !== "DIAJUKAN") throw new Error("Hanya pengajuan yang masih menunggu yang bisa dibatalkan.");
  await updateDoc(doc(dbClient(), KOLEKSI, pengajuan.id), {
    status: "DIBATALKAN" as StatusPengajuan,
    catatanKeputusan: `Dibatalkan oleh ${oleh}`,
    updatedAt: serverTimestamp(),
  });
}
