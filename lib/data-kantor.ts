"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { dbClient } from "@/lib/firebase";
import { hitungKantor } from "@/lib/kantor";
import { jadwalUntuk } from "@/lib/jadwal";
import { rapikanKode } from "@/lib/data";
import type { AbsenKantor, Employee, EventAbsenKantor, Kantor, TitikAbsen } from "@/types";

/* ---------------- Kantor ---------------- */

export function pantauKantor(onData: (d: Kantor[]) => void, onGagal: () => void) {
  return onSnapshot(
    collection(dbClient(), "offices"),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Kantor, "id">) }));
      isi.sort((a, b) => a.nama.localeCompare(b.nama));
      onData(isi);
    },
    onGagal
  );
}

export async function semuaKantor(): Promise<Kantor[]> {
  const snap = await getDocs(collection(dbClient(), "offices"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Kantor, "id">) }));
}

/** Kode kantor dipakai sebagai ID dokumen, jadi dijamin tidak dobel. */
export async function buatKantor(data: Omit<Kantor, "id" | "createdAt" | "updatedAt">) {
  const id = rapikanKode(data.code);
  if (!id) throw new Error("Kode kantor wajib diisi.");
  const ref = doc(dbClient(), "offices", id);
  if ((await getDoc(ref)).exists()) throw new Error(`Kode kantor "${id}" sudah dipakai.`);
  await setDoc(ref, {
    ...data,
    code: id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function ubahKantor(id: string, data: Partial<Kantor>) {
  const { id: _a, code: _b, createdAt: _c, ...bersih } = data as Kantor;
  await updateDoc(doc(dbClient(), "offices", id), { ...bersih, updatedAt: serverTimestamp() });
}

/* ---------------- Absensi kantor ---------------- */

export function idAbsenKantor(employeeId: string, tanggal: string) {
  return `${employeeId}_${tanggal}`;
}

export function pantauAbsenKantor(
  dari: string,
  sampai: string,
  onData: (d: AbsenKantor[]) => void,
  onGagal: () => void,
  employeeId?: string
) {
  const dasar = collection(dbClient(), "officeAttendance");
  const q = employeeId
    ? query(dasar, where("employeeId", "==", employeeId), where("date", ">=", dari), where("date", "<=", sampai))
    : query(dasar, where("date", ">=", dari), where("date", "<=", sampai));

  return onSnapshot(
    q,
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AbsenKantor, "id">) }));
      isi.sort(
        (a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName)
      );
      onData(isi);
    },
    onGagal
  );
}

export async function ambilAbsenHariIni(
  employeeId: string,
  tanggal: string
): Promise<AbsenKantor | null> {
  const snap = await getDoc(doc(dbClient(), "officeAttendance", idAbsenKantor(employeeId, tanggal)));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<AbsenKantor, "id">) } : null;
}

/**
 * Mencatat absen masuk atau pulang.
 *
 * Dokumennya ber-ID orang + tanggal, jadi satu orang tidak mungkin punya
 * dua catatan di hari yang sama — termasuk kalau tombolnya tertekan dua
 * kali atau sinyalnya putus lalu tersambung lagi.
 */
export async function catatAbsenKantor(opsi: {
  karyawan: Employee;
  tanggal: string;
  jenis: "masuk" | "pulang";
  titik: TitikAbsen;
  photoUrl: string;
  kantorId: string;
  kantorNama: string;
  diLuarRadius: boolean;
  alasan: string;
}) {
  if (opsi.diLuarRadius && !opsi.alasan.trim()) {
    throw new Error("Absen dari luar jangkauan kantor wajib disertai alasan.");
  }

  const db = dbClient();
  const id = idAbsenKantor(opsi.karyawan.id, opsi.tanggal);
  const ref = doc(db, "officeAttendance", id);
  const snap = await getDoc(ref);
  const kini = snap.exists() ? (snap.data() as AbsenKantor) : null;

  if (kini?.[opsi.jenis]) {
    throw new Error(
      opsi.jenis === "masuk" ? "Absen masuk hari ini sudah tercatat." : "Absen pulang hari ini sudah tercatat."
    );
  }
  if (opsi.jenis === "pulang" && !kini?.masuk) {
    throw new Error("Absen masuk belum tercatat. Absen masuk dulu.");
  }

  const jadwal = jadwalUntuk(opsi.karyawan, opsi.tanggal);
  const sekarang = new Date().toISOString();

  const event: Omit<EventAbsenKantor, "recordedAt"> = {
    waktu: sekarang,
    location: opsi.titik,
    photoUrl: opsi.photoUrl,
    diLuarRadius: opsi.diLuarRadius,
    alasan: opsi.alasan.trim(),
    kantorId: opsi.kantorId,
    kantorNama: opsi.kantorNama,
  };

  const jamMasuk =
    opsi.jenis === "masuk" ? sekarang.slice(11, 16) : kini?.masuk?.waktu.slice(11, 16) || null;
  const jamPulang = opsi.jenis === "pulang" ? sekarang.slice(11, 16) : null;

  const hitung = hitungKantor({
    masuk: jamMasuk,
    pulang: jamPulang,
    jadwalMasuk: jadwal.masuk,
    jadwalPulang: jadwal.pulang,
  });

  if (!snap.exists()) {
    await setDoc(ref, {
      employeeId: opsi.karyawan.id,
      employeeName: opsi.karyawan.name,
      divisi: opsi.karyawan.divisi || "",
      date: opsi.tanggal,
      masuk: null,
      pulang: null,
      jadwalMasuk: jadwal.masuk,
      jadwalPulang: jadwal.pulang,
      workHours: 0,
      terlambatMenit: 0,
      pulangCepatMenit: 0,
      status: "HADIR",
      perluValidasi: false,
      hasilValidasi: null,
      catatanValidasi: "",
      koreksiMasuk: null,
      koreksiPulang: null,
      alasanKoreksi: "",
      isOverridden: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Jam server ikut disimpan di samping jam perangkat, supaya selisihnya
  // terlihat kalau ada jam HP yang disetel jauh.
  await updateDoc(ref, {
    [`${opsi.jenis}.waktu`]: event.waktu,
    [`${opsi.jenis}.recordedAt`]: serverTimestamp(),
    [`${opsi.jenis}.location`]: event.location,
    [`${opsi.jenis}.photoUrl`]: event.photoUrl,
    [`${opsi.jenis}.diLuarRadius`]: event.diLuarRadius,
    [`${opsi.jenis}.alasan`]: event.alasan,
    [`${opsi.jenis}.kantorId`]: event.kantorId,
    [`${opsi.jenis}.kantorNama`]: event.kantorNama,
    workHours: hitung.workHours,
    terlambatMenit: hitung.terlambatMenit,
    pulangCepatMenit: hitung.pulangCepatMenit,
    status: hitung.status,
    perluValidasi: (kini?.perluValidasi ?? false) || opsi.diLuarRadius,
    updatedAt: serverTimestamp(),
  });
}

export async function putuskanAbsenLuar(opsi: {
  absen: AbsenKantor;
  hasil: "DITERIMA" | "DITOLAK";
  catatan: string;
  oleh: string;
}) {
  await updateDoc(doc(dbClient(), "officeAttendance", opsi.absen.id), {
    hasilValidasi: opsi.hasil,
    catatanValidasi: `${opsi.catatan.trim()} — oleh ${opsi.oleh}`,
    perluValidasi: false,
    updatedAt: serverTimestamp(),
  });
}

/** Koreksi jam oleh Admin. Jam asli tetap tersimpan di event-nya. */
export async function koreksiAbsenKantor(opsi: {
  absen: AbsenKantor;
  koreksiMasuk: string;
  koreksiPulang: string;
  alasan: string;
  oleh: string;
}) {
  if (!opsi.alasan.trim()) throw new Error("Alasan koreksi wajib diisi.");

  const masuk = opsi.koreksiMasuk || opsi.absen.masuk?.waktu.slice(11, 16) || null;
  const pulang = opsi.koreksiPulang || opsi.absen.pulang?.waktu.slice(11, 16) || null;

  const hitung = hitungKantor({
    masuk,
    pulang,
    jadwalMasuk: opsi.absen.jadwalMasuk,
    jadwalPulang: opsi.absen.jadwalPulang,
  });

  await updateDoc(doc(dbClient(), "officeAttendance", opsi.absen.id), {
    koreksiMasuk: opsi.koreksiMasuk || null,
    koreksiPulang: opsi.koreksiPulang || null,
    alasanKoreksi: `${opsi.alasan.trim()} — oleh ${opsi.oleh}`,
    isOverridden: true,
    workHours: hitung.workHours,
    terlambatMenit: hitung.terlambatMenit,
    pulangCepatMenit: hitung.pulangCepatMenit,
    status: hitung.status,
    updatedAt: serverTimestamp(),
  });
}
