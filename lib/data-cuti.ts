"use client";

import {
  collection,
  deleteDoc,
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
import { JATAH_SAKIT, JENIS_CUTI, jatahTahunanUntuk } from "@/lib/cuti";
import type {
  Employee,
  HariLibur,
  JenisLibur,
  PengajuanCuti,
  SaldoCuti,
  StatusPengajuan,
} from "@/types";

/* ---------------- Hari libur ---------------- */

export function pantauHariLibur(
  tahun: number,
  onData: (data: HariLibur[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(
      collection(dbClient(), "holidays"),
      where("tanggal", ">=", `${tahun}-01-01`),
      where("tanggal", "<=", `${tahun}-12-31`)
    ),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HariLibur, "id">) }));
      isi.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      onData(isi);
    },
    onGagal
  );
}

export async function ambilHariLibur(tahun: number): Promise<HariLibur[]> {
  const snap = await getDocs(
    query(
      collection(dbClient(), "holidays"),
      where("tanggal", ">=", `${tahun}-01-01`),
      where("tanggal", "<=", `${tahun}-12-31`)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HariLibur, "id">) }));
}

/** Tanggal dipakai sebagai ID dokumen, jadi satu tanggal tidak bisa dobel. */
export async function tambahHariLibur(data: {
  tanggal: string;
  nama: string;
  jenis: JenisLibur;
  oleh: string;
}) {
  const ref = doc(dbClient(), "holidays", data.tanggal);
  const ada = await getDoc(ref);
  if (ada.exists()) throw new Error(`Tanggal ${data.tanggal} sudah terdaftar sebagai hari libur.`);
  await setDoc(ref, {
    tanggal: data.tanggal,
    nama: data.nama,
    jenis: data.jenis,
    saldoDipotong: false,
    dibuatOleh: data.oleh,
    createdAt: serverTimestamp(),
  });
}

export async function hapusHariLibur(tanggal: string) {
  await deleteDoc(doc(dbClient(), "holidays", tanggal));
}

/* ---------------- Saldo cuti ---------------- */

export function idSaldo(employeeId: string, tahun: number) {
  return `${employeeId}_${tahun}`;
}

export function pantauSaldo(
  tahun: number,
  onData: (data: SaldoCuti[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), "leaveBalances"), where("tahun", "==", tahun)),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SaldoCuti, "id">) }));
      isi.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
      onData(isi);
    },
    onGagal
  );
}

export async function ambilSaldo(employeeId: string, tahun: number): Promise<SaldoCuti | null> {
  const snap = await getDoc(doc(dbClient(), "leaveBalances", idSaldo(employeeId, tahun)));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<SaldoCuti, "id">) } : null;
}

/**
 * Membuat kartu saldo tahun berjalan untuk karyawan yang belum punya.
 * Jatah tahunannya dihitung dari tanggal masuk (jatahTahunanUntuk): nol di
 * tahun masuk, prorata di tahun kedua, penuh sesudahnya.
 */
export async function siapkanSaldo(karyawan: Employee, tahun: number, oleh: string) {
  const ref = doc(dbClient(), "leaveBalances", idSaldo(karyawan.id, tahun));
  const ada = await getDoc(ref);
  if (ada.exists()) return;

  await setDoc(ref, {
    employeeId: karyawan.id,
    employeeName: karyawan.name,
    tahun,
    jatahTahunan: jatahTahunanUntuk(karyawan.joinDate, tahun),
    penyesuaian: 0,
    tahunanTerpakai: 0,
    jatahSakit: JATAH_SAKIT,
    sakitTerpakai: 0,
    catatan: `Dibuat otomatis oleh ${oleh}`,
    updatedAt: serverTimestamp(),
  });
}

export async function ubahSaldo(
  saldoId: string,
  ubahan: Partial<Pick<SaldoCuti, "jatahTahunan" | "penyesuaian" | "jatahSakit" | "catatan">>
) {
  await updateDoc(doc(dbClient(), "leaveBalances", saldoId), {
    ...ubahan,
    updatedAt: serverTimestamp(),
  });
}

/* ---------------- Pengajuan ---------------- */

export function pantauPengajuan(
  onData: (data: PengajuanCuti[]) => void,
  onGagal: () => void,
  employeeId?: string
) {
  const dasar = collection(dbClient(), "leaveRequests");
  const q = employeeId ? query(dasar, where("employeeId", "==", employeeId)) : query(dasar);

  return onSnapshot(
    q,
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PengajuanCuti, "id">) }));
      isi.sort((a, b) => b.tanggalMulai.localeCompare(a.tanggalMulai));
      onData(isi);
    },
    onGagal
  );
}

export async function ajukanCuti(data: Omit<PengajuanCuti, "id" | "createdAt" | "updatedAt">) {
  const ref = doc(collection(dbClient(), "leaveRequests"));
  await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

/** Pengajuan yang tanggalnya beririsan, untuk aturan satu divisi satu orang. */
export async function pengajuanBeririsan(
  divisi: string,
  mulai: string,
  selesai: string,
  kecualiEmployeeId: string
): Promise<PengajuanCuti[]> {
  if (!divisi) return [];
  const snap = await getDocs(
    query(
      collection(dbClient(), "leaveRequests"),
      where("divisi", "==", divisi),
      where("status", "in", ["DIAJUKAN", "DISETUJUI"])
    )
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<PengajuanCuti, "id">) }))
    .filter(
      (p) =>
        p.employeeId !== kecualiEmployeeId &&
        p.tanggalMulai <= selesai &&
        p.tanggalSelesai >= mulai &&
        p.jumlahHari > 0
    );
}

/**
 * Memutuskan pengajuan. Saldo baru dipotong saat DISETUJUI, dan
 * dikembalikan lagi kalau keputusannya dibatalkan — dijaga penanda
 * saldoDipotong supaya tidak terpotong atau kembali dua kali.
 */
/**
 * Tahap pertama, "Diketahui": atasan langsung si karyawan (atasanId disalin
 * saat pengajuan dibuat), atau HR/Admin sebagai cadangan. Bukan persetujuan;
 * keputusan tetap di tahap kedua.
 */
export async function ketahuiPengajuan(pengajuan: PengajuanCuti, oleh: string) {
  await updateDoc(doc(dbClient(), "leaveRequests", pengajuan.id), {
    diketahuiOleh: oleh,
    diketahuiPada: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function putuskanPengajuan(opsi: {
  pengajuan: PengajuanCuti;
  status: Extract<StatusPengajuan, "DISETUJUI" | "DITOLAK">;
  catatan: string;
  oleh: string;
  /** HR/Admin sebagai cadangan menandai "diketahui" sekaligus saat menyetujui. */
  tandaiDiketahuiJuga?: boolean;
}) {
  const db = dbClient();
  const aturan = JENIS_CUTI[opsi.pengajuan.jenis];
  const tahun = Number(opsi.pengajuan.tanggalMulai.slice(0, 4));

  // Dua tahap (client C3, 10 Okt 2026): tidak bisa disetujui sebelum
  // diketahui atasan langsung. Ditegakkan juga di Security Rules.
  const sudahDiketahui = !!opsi.pengajuan.diketahuiOleh || !!opsi.tandaiDiketahuiJuga;
  if (opsi.status === "DISETUJUI" && !sudahDiketahui) {
    throw new Error("Pengajuan belum ditandai diketahui oleh atasan langsung. Minta atasannya menandai dulu dari menu Cuti dan izin.");
  }

  let saldoDipotong = opsi.pengajuan.saldoDipotong;

  if (opsi.status === "DISETUJUI" && !saldoDipotong && opsi.pengajuan.jumlahHari > 0) {
    const ref = doc(db, "leaveBalances", idSaldo(opsi.pengajuan.employeeId, tahun));
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const saldo = snap.data() as SaldoCuti;
      if (aturan?.potongSaldo) {
        await updateDoc(ref, {
          tahunanTerpakai: saldo.tahunanTerpakai + opsi.pengajuan.jumlahHari,
          updatedAt: serverTimestamp(),
        });
        saldoDipotong = true;
      } else if (aturan?.potongSakit) {
        await updateDoc(ref, {
          sakitTerpakai: saldo.sakitTerpakai + opsi.pengajuan.jumlahHari,
          updatedAt: serverTimestamp(),
        });
        saldoDipotong = true;
      }
    }
  }

  await updateDoc(doc(db, "leaveRequests", opsi.pengajuan.id), {
    status: opsi.status,
    catatanKeputusan: opsi.catatan,
    diputuskanOleh: opsi.oleh,
    saldoDipotong,
    updatedAt: serverTimestamp(),
    ...(opsi.tandaiDiketahuiJuga && !opsi.pengajuan.diketahuiOleh
      ? { diketahuiOleh: opsi.oleh, diketahuiPada: serverTimestamp() }
      : {}),
  });
}

/** Pembatalan cuti yang sudah disetujui; saldonya dikembalikan. */
export async function batalkanPengajuan(pengajuan: PengajuanCuti, alasan: string, oleh: string) {
  const db = dbClient();
  const aturan = JENIS_CUTI[pengajuan.jenis];
  const tahun = Number(pengajuan.tanggalMulai.slice(0, 4));

  if (pengajuan.saldoDipotong) {
    const ref = doc(db, "leaveBalances", idSaldo(pengajuan.employeeId, tahun));
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const saldo = snap.data() as SaldoCuti;
      if (aturan?.potongSaldo) {
        await updateDoc(ref, {
          tahunanTerpakai: Math.max(0, saldo.tahunanTerpakai - pengajuan.jumlahHari),
          updatedAt: serverTimestamp(),
        });
      } else if (aturan?.potongSakit) {
        await updateDoc(ref, {
          sakitTerpakai: Math.max(0, saldo.sakitTerpakai - pengajuan.jumlahHari),
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  await updateDoc(doc(db, "leaveRequests", pengajuan.id), {
    status: "DIBATALKAN" as StatusPengajuan,
    catatanKeputusan: `Dibatalkan oleh ${oleh}: ${alasan}`,
    saldoDipotong: false,
    updatedAt: serverTimestamp(),
  });
}

/** Pengajuan cuti seluruh bawahan seorang atasan. */
export function pantauCutiBawahan(
  atasanId: string,
  onData: (d: PengajuanCuti[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), "leaveRequests"), where("atasanId", "==", atasanId)),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PengajuanCuti, "id">) }));
      isi.sort((a, b) => b.tanggalMulai.localeCompare(a.tanggalMulai));
      onData(isi);
    },
    onGagal
  );
}
