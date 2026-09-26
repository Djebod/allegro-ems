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
import { jadwalUntuk, tafsirScan } from "@/lib/absensi-kantor";
import type { AbsenKantor, Employee, PetaMesin } from "@/types";
import type { BarisMesin } from "@/lib/impor-absensi";

/* ---------------- Pemetaan nomor mesin ---------------- */

export function pantauPetaMesin(
  onData: (data: PetaMesin[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    collection(dbClient(), "fingerprintMap"),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PetaMesin, "id">) }))),
    onGagal
  );
}

export async function simpanPetaMesin(data: {
  mesinId: string;
  namaDiMesin: string;
  karyawan: Employee;
  oleh: string;
}) {
  await setDoc(doc(dbClient(), "fingerprintMap", data.mesinId), {
    mesinId: data.mesinId,
    namaDiMesin: data.namaDiMesin,
    employeeId: data.karyawan.id,
    employeeName: data.karyawan.name,
    dibuatOleh: data.oleh,
    createdAt: serverTimestamp(),
  });
}

/* ---------------- Absensi kantor ---------------- */

export function idAbsenKantor(employeeId: string, tanggal: string) {
  return `${employeeId}_${tanggal}`;
}

export function pantauAbsenKantor(
  dari: string,
  sampai: string,
  onData: (data: AbsenKantor[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(
      collection(dbClient(), "officeAttendance"),
      where("date", ">=", dari),
      where("date", "<=", sampai)
    ),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AbsenKantor, "id">) }));
      isi.sort(
        (a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName)
      );
      onData(isi);
    },
    onGagal
  );
}

export interface HasilImpor {
  tersimpan: number;
  dilewati: number;
  tanpaPemetaan: { mesinId: string; nama: string }[];
}

/**
 * Menyimpan hasil impor. Catatan yang sudah dikoreksi Admin TIDAK
 * ditimpa — impor ulang di bulan yang sama aman dilakukan, dan koreksi
 * yang sudah dikerjakan tidak hilang.
 */
export async function simpanImpor(opsi: {
  baris: BarisMesin[];
  peta: PetaMesin[];
  karyawan: Employee[];
  oleh: string;
}): Promise<HasilImpor> {
  const db = dbClient();
  const petaMap = new Map(opsi.peta.map((p) => [p.mesinId, p]));
  const karyawanMap = new Map(opsi.karyawan.map((k) => [k.id, k]));

  const tanpaPemetaan = new Map<string, string>();
  let tersimpan = 0;
  let dilewati = 0;

  for (const b of opsi.baris) {
    const peta = petaMap.get(b.mesinId);
    if (!peta) {
      tanpaPemetaan.set(b.mesinId, b.namaDiMesin);
      continue;
    }
    const orang = karyawanMap.get(peta.employeeId);
    if (!orang) {
      tanpaPemetaan.set(b.mesinId, b.namaDiMesin);
      continue;
    }

    const id = idAbsenKantor(orang.id, b.tanggal);
    const ref = doc(db, "officeAttendance", id);
    const ada = await getDoc(ref);

    if (ada.exists() && (ada.data() as AbsenKantor).isOverridden) {
      dilewati += 1;
      continue;
    }

    const jadwal = jadwalUntuk(orang, b.tanggal);
    const hasil = tafsirScan({
      scans: b.scans,
      jadwalMasuk: jadwal.masuk,
      jadwalPulang: jadwal.pulang,
    });

    await setDoc(
      ref,
      {
        employeeId: orang.id,
        employeeName: orang.name,
        divisi: orang.divisi || "",
        date: b.tanggal,
        scans: b.scans,
        masuk: hasil.masuk,
        istirahatKeluar: hasil.istirahatKeluar,
        istirahatMasuk: hasil.istirahatMasuk,
        pulang: hasil.pulang,
        jadwalMasuk: jadwal.masuk,
        jadwalPulang: jadwal.pulang,
        workHours: hasil.workHours,
        terlambatMenit: hasil.terlambatMenit,
        pulangCepatMenit: hasil.pulangCepatMenit,
        status: hasil.status,
        catatan: hasil.catatan,
        koreksiMasuk: null,
        koreksiPulang: null,
        alasanKoreksi: "",
        isOverridden: false,
        diimporOleh: opsi.oleh,
        createdAt: ada.exists() ? (ada.data() as AbsenKantor).createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );
    tersimpan += 1;
  }

  return {
    tersimpan,
    dilewati,
    tanpaPemetaan: [...tanpaPemetaan].map(([mesinId, nama]) => ({ mesinId, nama })),
  };
}

/**
 * Koreksi jam oleh Admin. Jam asli dari mesin tetap tersimpan; yang
 * dipakai menghitung adalah jam koreksinya.
 */
export async function koreksiAbsenKantor(opsi: {
  absen: AbsenKantor;
  koreksiMasuk: string;
  koreksiPulang: string;
  alasan: string;
  oleh: string;
}) {
  if (!opsi.alasan.trim()) throw new Error("Alasan koreksi wajib diisi.");

  const masuk = opsi.koreksiMasuk || opsi.absen.masuk;
  const pulang = opsi.koreksiPulang || opsi.absen.pulang;

  const hasil = tafsirScan({
    scans: [masuk, opsi.absen.istirahatKeluar, opsi.absen.istirahatMasuk, pulang].filter(
      (x): x is string => Boolean(x)
    ),
    jadwalMasuk: opsi.absen.jadwalMasuk,
    jadwalPulang: opsi.absen.jadwalPulang,
  });

  await updateDoc(doc(dbClient(), "officeAttendance", opsi.absen.id), {
    koreksiMasuk: opsi.koreksiMasuk || null,
    koreksiPulang: opsi.koreksiPulang || null,
    alasanKoreksi: `${opsi.alasan.trim()} — oleh ${opsi.oleh}`,
    isOverridden: true,
    workHours: hasil.workHours,
    terlambatMenit: hasil.terlambatMenit,
    pulangCepatMenit: hasil.pulangCepatMenit,
    status: hasil.status,
    updatedAt: serverTimestamp(),
  });
}

export async function semuaPetaMesin(): Promise<PetaMesin[]> {
  const snap = await getDocs(collection(dbClient(), "fingerprintMap"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PetaMesin, "id">) }));
}
