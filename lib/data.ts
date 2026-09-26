"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { dbClient } from "@/lib/firebase";
import type {
  Attendance,
  AttendanceCorrection,
  Employee,
  EmployeeAssignment,
  EmployeeLoan,
  EmployeePrivate,
  EventAbsen,
  HasilValidasi,
  JenisSesi,
  LoanRepayment,
  Payroll,
  PayrollItem,
  Project,
  SalaryRate,
  Section,
  StatusBon,
  StatusPayroll,
  TitikAbsen,
} from "@/types";
import { gabungTanggalJam, hitungJam, idAbsensi, NAMA_SESI, periksaSesi } from "@/lib/absensi";
import { hitungUpahKaryawan, segarkanItem } from "@/lib/payroll";

/**
 * Kode dipakai sebagai ID dokumen, jadi harus dirapikan lebih dulu:
 * huruf besar, spasi jadi strip, karakter aneh dibuang.
 */
export function rapikanKode(teks: string): string {
  return teks
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function idSection(kodeProyek: string, kodeSection: string): string {
  return `${rapikanKode(kodeProyek)}__${rapikanKode(kodeSection)}`;
}

/* ---------------- Proyek ---------------- */

export function pantauProyek(
  onData: (data: Project[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), "projects"), orderBy("name")),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, "id">) }))),
    onGagal
  );
}

export async function ambilProyek(id: string): Promise<Project | null> {
  const snap = await getDoc(doc(dbClient(), "projects", id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Project, "id">) } : null;
}

/** Membuat proyek baru. Ditolak Firestore bila kodenya sudah dipakai. */
export async function buatProyek(data: Omit<Project, "id" | "createdAt" | "updatedAt">) {
  const id = rapikanKode(data.code);
  const ref = doc(dbClient(), "projects", id);
  const ada = await getDoc(ref);
  if (ada.exists()) throw new Error(`Kode proyek "${id}" sudah dipakai.`);
  await setDoc(ref, { ...data, code: id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return id;
}

export async function ubahProyek(id: string, data: Partial<Project>) {
  const { id: _buang, code: _kode, createdAt: _dibuat, ...bersih } = data as Project;
  await updateDoc(doc(dbClient(), "projects", id), { ...bersih, updatedAt: serverTimestamp() });
}

/* ---------------- Section ---------------- */

export function pantauSection(
  projectId: string,
  onData: (data: Section[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), "sections"), where("projectId", "==", projectId)),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Section, "id">) }));
      isi.sort((a, b) => a.name.localeCompare(b.name));
      onData(isi);
    },
    onGagal
  );
}

export async function buatSection(data: Omit<Section, "id" | "createdAt" | "updatedAt">) {
  const id = idSection(data.projectId, data.code);
  const ref = doc(dbClient(), "sections", id);
  const ada = await getDoc(ref);
  if (ada.exists()) throw new Error(`Kode section "${rapikanKode(data.code)}" sudah ada di proyek ini.`);
  await setDoc(ref, {
    ...data,
    code: rapikanKode(data.code),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function ubahSection(id: string, data: Partial<Section>) {
  const { id: _b, code: _k, projectId: _p, createdAt: _c, ...bersih } = data as Section;
  await updateDoc(doc(dbClient(), "sections", id), { ...bersih, updatedAt: serverTimestamp() });
}

/* ---------------- Karyawan ---------------- */

export function pantauKaryawan(
  onData: (data: Employee[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), "employees"), orderBy("name")),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) }))),
    onGagal
  );
}

/** NIK juga diperiksa supaya satu orang tidak terdaftar dua kali. */
export async function buatKaryawan(data: Omit<Employee, "id" | "createdAt" | "updatedAt">) {
  const id = rapikanKode(data.employeeCode);
  const ref = doc(dbClient(), "employees", id);
  const ada = await getDoc(ref);
  if (ada.exists()) throw new Error(`Kode karyawan "${id}" sudah dipakai.`);

  const nikSama = await getDocs(
    query(collection(dbClient(), "employees"), where("nik", "==", data.nik))
  );
  if (!nikSama.empty) {
    throw new Error(`NIK ini sudah terdaftar atas nama ${nikSama.docs[0].data().name}.`);
  }

  await setDoc(ref, {
    ...data,
    employeeCode: id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function ubahKaryawan(id: string, data: Partial<Employee>) {
  const { id: _b, employeeCode: _k, createdAt: _c, ...bersih } = data as Employee;
  await updateDoc(doc(dbClient(), "employees", id), { ...bersih, updatedAt: serverTimestamp() });
}

/** Dipakai hanya untuk membatalkan salah input di hari yang sama. */
export async function hapusKaryawan(id: string) {
  await deleteDoc(doc(dbClient(), "employees", id));
}

/* ---------------- Tarif gaji ---------------- */


function hariSebelum(tanggal: string): string {
  const d = new Date(`${tanggal}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function pantauTarif(
  employeeId: string,
  onData: (data: SalaryRate[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), "salaryRates"), where("employeeId", "==", employeeId)),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SalaryRate, "id">) }));
      isi.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
      onData(isi);
    },
    onGagal
  );
}

/**
 * Tarif lama tidak dihapus, hanya ditutup masa berlakunya sehari sebelum
 * tarif baru mulai. Payroll lama tetap memakai angka yang benar.
 */
export async function pasangTarifBaru(
  data: Omit<SalaryRate, "id" | "effectiveUntil" | "createdAt">
) {
  const db = dbClient();
  const lama = await getDocs(
    query(
      collection(db, "salaryRates"),
      where("employeeId", "==", data.employeeId),
      where("effectiveUntil", "==", null)
    )
  );

  for (const d of lama.docs) {
    const mulaiLama = String(d.data().effectiveFrom);
    if (mulaiLama >= data.effectiveFrom) {
      throw new Error(
        `Sudah ada tarif yang berlaku sejak ${mulaiLama}. Tanggal mulai tarif baru harus setelah itu.`
      );
    }
    await updateDoc(d.ref, { effectiveUntil: hariSebelum(data.effectiveFrom) });
  }

  const ref = doc(collection(db, "salaryRates"));
  await setDoc(ref, { ...data, effectiveUntil: null, createdAt: serverTimestamp() });
  return ref.id;
}

/* ---------------- Penugasan ---------------- */

export function pantauPenugasan(
  employeeId: string,
  onData: (data: EmployeeAssignment[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), "employeeAssignments"), where("employeeId", "==", employeeId)),
    (snap) => {
      const isi = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<EmployeeAssignment, "id">),
      }));
      isi.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
      onData(isi);
    },
    onGagal
  );
}

/**
 * Menugaskan karyawan ke satu proyek/section. Penugasan sebelumnya
 * ditutup lebih dulu, sehingga seorang karyawan tidak pernah berada
 * di dua section pada tanggal yang sama.
 */
export async function tugaskanKaryawan(
  data: Omit<EmployeeAssignment, "id" | "effectiveUntil" | "status" | "createdAt">
) {
  const db = dbClient();
  const berjalan = await getDocs(
    query(
      collection(db, "employeeAssignments"),
      where("employeeId", "==", data.employeeId),
      where("status", "==", "ACTIVE")
    )
  );

  for (const d of berjalan.docs) {
    const mulaiLama = String(d.data().effectiveFrom);
    if (mulaiLama >= data.effectiveFrom) {
      throw new Error(
        `Karyawan ini sudah ditugaskan sejak ${mulaiLama}. Tanggal pindah harus setelah itu.`
      );
    }
    await updateDoc(d.ref, {
      effectiveUntil: hariSebelum(data.effectiveFrom),
      status: "ENDED",
    });
  }

  const ref = doc(collection(db, "employeeAssignments"));
  await setDoc(ref, {
    ...data,
    effectiveUntil: null,
    status: "ACTIVE",
    createdAt: serverTimestamp(),
  });

  // Cerminan penugasan berjalan, dipakai Security Rules untuk membatasi mandor.
  await updateDoc(doc(db, "employees", data.employeeId), {
    currentProjectId: data.projectId,
    currentSectionId: data.sectionId,
    currentMandorId: data.mandorId,
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

/* ---------------- Foto KTP (khusus Admin) ---------------- */

export async function ambilKtp(employeeId: string): Promise<EmployeePrivate | null> {
  const snap = await getDoc(doc(dbClient(), "employeePrivate", employeeId));
  return snap.exists() ? (snap.data() as EmployeePrivate) : null;
}

export async function simpanKtp(employeeId: string, url: string, publicId: string) {
  await setDoc(doc(dbClient(), "employeePrivate", employeeId), {
    employeeId,
    ktpPhotoUrl: url,
    ktpPublicId: publicId,
    updatedAt: serverTimestamp(),
  });
}

/* ---------------- Daftar bantu ---------------- */

export async function daftarMandor() {
  const snap = await getDocs(
    query(collection(dbClient(), "employees"), where("position", "==", "MANDOR"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) }));
}

export async function semuaSection() {
  const snap = await getDocs(collection(dbClient(), "sections"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Section, "id">) }));
}

export async function semuaProyek() {
  const snap = await getDocs(collection(dbClient(), "projects"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, "id">) }));
}

/* ---------------- Absensi ---------------- */


/** Karyawan yang sedang ditugaskan kepada seorang mandor (termasuk mandornya). */
export function pantauTimMandor(
  mandorId: string,
  onData: (data: Employee[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), "employees"), where("currentMandorId", "==", mandorId)),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) }));
      isi.sort((a, b) => {
        if (a.position !== b.position) return a.position === "MANDOR" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      onData(isi.filter((e) => e.status === "ACTIVE"));
    },
    onGagal
  );
}

export function pantauAbsensiHarian(
  mandorId: string,
  tanggal: string,
  onData: (data: Record<string, Attendance>) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(
      collection(dbClient(), "attendance"),
      where("mandorId", "==", mandorId),
      where("date", "==", tanggal)
    ),
    (snap) => {
      const peta: Record<string, Attendance> = {};
      snap.docs.forEach((d) => {
        const isi = { id: d.id, ...(d.data() as Omit<Attendance, "id">) };
        peta[isi.employeeId] = isi;
      });
      onData(peta);
    },
    onGagal
  );
}

/**
 * Mencatat satu sesi absensi. Dokumennya ber-ID employee + tanggal,
 * jadi satu orang tidak mungkin punya dua catatan di hari yang sama
 * walaupun tombolnya tertekan dua kali atau sinyalnya putus lalu
 * tersambung lagi.
 */
export async function catatSesi(opsi: {
  karyawan: Employee;
  projectId: string;
  sectionId: string;
  mandorId: string;
  tanggal: string;
  jenis: JenisSesi;
  titik: TitikAbsen;
  photoUrl: string;
  oleh: string;
}) {
  const db = dbClient();
  const id = idAbsensi(opsi.karyawan.id, opsi.tanggal);
  const ref = doc(db, "attendance", id);
  const snap = await getDoc(ref);
  const sekarang = snap.exists() ? (snap.data() as Partial<Attendance>) : {};

  const cek = periksaSesi(sekarang, opsi.jenis);
  if (!cek.boleh) throw new Error(cek.alasan || "Sesi ini tidak bisa dicatat.");

  if (!snap.exists()) {
    await setDoc(ref, {
      employeeId: opsi.karyawan.id,
      employeeName: opsi.karyawan.name,
      projectId: opsi.projectId,
      sectionId: opsi.sectionId,
      mandorId: opsi.mandorId,
      date: opsi.tanggal,
      workHours: 0,
      overtimeHours: 0,
      status: "BELUM",
      isOverridden: false,
      terakhir: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const event: EventAbsen = {
    waktu: new Date().toISOString(),
    recordedBy: opsi.oleh,
    location: opsi.titik,
    photoUrl: opsi.photoUrl,
  };

  const hitung = hitungJam({ ...sekarang, [opsi.jenis]: event });

  // Ditulis dengan jalur bertitik supaya jam server bisa dipakai di
  // dalam event, bukan jam HP yang bisa saja disetel mundur.
  await updateDoc(ref, {
    [`${opsi.jenis}.waktu`]: event.waktu,
    [`${opsi.jenis}.recordedAt`]: serverTimestamp(),
    [`${opsi.jenis}.recordedBy`]: event.recordedBy,
    [`${opsi.jenis}.location`]: event.location,
    [`${opsi.jenis}.photoUrl`]: event.photoUrl,
    workHours: hitung.workHours,
    overtimeHours: hitung.overtimeHours,
    status: hitung.status,
    terakhir: { jenis: opsi.jenis, jarakMeter: opsi.titik.distanceFromProjectMeter },
    updatedAt: serverTimestamp(),
  });

  return NAMA_SESI[opsi.jenis];
}

/**
 * Rekap absensi satu rentang tanggal untuk Admin dan Finance.
 *
 * Saringan proyek sengaja dikerjakan di sisi aplikasi, bukan ditambahkan
 * ke query. Menggabungkan rentang tanggal dengan kesamaan projectId akan
 * menuntut composite index di Firestore — satu langkah manual lagi yang
 * mudah terlupa. Jumlah datanya kecil, jadi menyaring di sini lebih murah
 * daripada menambah kerumitan.
 */
export function pantauAbsensiRentang(
  dari: string,
  sampai: string,
  onData: (data: Attendance[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(
      collection(dbClient(), "attendance"),
      where("date", ">=", dari),
      where("date", "<=", sampai)
    ),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Attendance, "id">) }));
      isi.sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName)
      );
      onData(isi);
    },
    onGagal
  );
}

/* ---------------- Validasi & koreksi absensi ---------------- */


/**
 * Admin menilai satu sesi absensi, sekaligus boleh membetulkan jamnya.
 *
 * Jam aslinya TIDAK pernah ditimpa — jam koreksi disimpan di kolom
 * terpisah, dan seluruh perubahan dicatat di attendanceCorrections
 * yang tidak bisa diubah maupun dihapus. Itu syarat dasar audit:
 * harus selalu bisa dilihat apa yang semula tercatat.
 */
export async function simpanValidasi(opsi: {
  absen: Attendance;
  jenis: JenisSesi;
  hasil: HasilValidasi;
  alasan: string;
  buktiUrl: string | null;
  jamAktual: string;
  oleh: string;
}) {
  const event = opsi.absen[opsi.jenis];
  if (!event) throw new Error("Sesi ini belum pernah tercatat.");

  if (opsi.hasil === "TIDAK_VALID") {
    if (!opsi.alasan.trim()) throw new Error("Alasan wajib diisi bila sesi dinyatakan tidak valid.");
    if (!opsi.buktiUrl) throw new Error("Foto bukti wajib dilampirkan bila sesi dinyatakan tidak valid.");
  }

  const waktuBaru = opsi.jamAktual
    ? gabungTanggalJam(opsi.absen.date, opsi.jamAktual)
    : null;

  const validasi = {
    hasil: opsi.hasil,
    alasan: opsi.alasan.trim(),
    buktiUrl: opsi.buktiUrl,
    oleh: opsi.oleh,
    pada: serverTimestamp(),
  };

  const eventBaru = { ...event, waktuAktual: waktuBaru, validasi };
  const hitung = hitungJam({ ...opsi.absen, [opsi.jenis]: eventBaru });

  const db = dbClient();

  await updateDoc(doc(db, "attendance", opsi.absen.id), {
    [`${opsi.jenis}.waktuAktual`]: waktuBaru,
    [`${opsi.jenis}.validasi`]: validasi,
    workHours: hitung.workHours,
    overtimeHours: hitung.overtimeHours,
    status: hitung.status,
    isOverridden: Boolean(waktuBaru) || opsi.hasil === "TIDAK_VALID",
    updatedAt: serverTimestamp(),
  });

  const jejak = doc(collection(db, "attendanceCorrections"));
  await setDoc(jejak, {
    attendanceId: opsi.absen.id,
    employeeId: opsi.absen.employeeId,
    employeeName: opsi.absen.employeeName,
    date: opsi.absen.date,
    field: opsi.jenis,
    hasil: opsi.hasil,
    waktuLama: event.waktu,
    waktuBaru,
    alasan: opsi.alasan.trim(),
    attachmentUrl: opsi.buktiUrl,
    approvedBy: opsi.oleh,
    createdAt: serverTimestamp(),
  });

  return hitung;
}

export function pantauKoreksi(
  attendanceId: string,
  onData: (data: AttendanceCorrection[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), "attendanceCorrections"), where("attendanceId", "==", attendanceId)),
    (snap) =>
      onData(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceCorrection, "id">) }))
      ),
    onGagal
  );
}

/* ---------------- Bon karyawan ---------------- */


const BON_BERJALAN: StatusBon[] = ["OPEN", "PARTIALLY_PAID"];

export function pantauBon(
  onData: (data: EmployeeLoan[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    collection(dbClient(), "employeeLoans"),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EmployeeLoan, "id">) }));
      isi.sort((a, b) => b.loanDate.localeCompare(a.loanDate));
      onData(isi);
    },
    onGagal
  );
}

export function pantauPembayaranBon(
  loanId: string,
  onData: (data: LoanRepayment[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), "loanRepayments"), where("loanId", "==", loanId)),
    (snap) =>
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LoanRepayment, "id">) }))),
    onGagal
  );
}

/**
 * Membuat bon baru. Penanda bon berjalan dibuat LEBIH DULU: kalau
 * karyawan itu masih punya bon aktif, Firestore menolak di langkah ini
 * dan bonnya tidak pernah terbentuk. Urutannya sengaja begitu, supaya
 * tidak pernah ada bon yatim tanpa penanda.
 */
export async function buatBon(data: {
  karyawan: Employee;
  jumlah: number;
  tanggal: string;
  keterangan: string;
  oleh: string;
}) {
  if (data.jumlah <= 0) throw new Error("Nominal bon harus lebih dari nol.");

  const db = dbClient();
  const bonRef = doc(collection(db, "employeeLoans"));

  try {
    await setDoc(doc(db, "loanLocks", data.karyawan.id), {
      employeeId: data.karyawan.id,
      loanId: bonRef.id,
      createdAt: serverTimestamp(),
    });
  } catch {
    throw new Error(
      `${data.karyawan.name} masih punya bon yang belum lunas. Satu karyawan hanya boleh punya satu bon aktif.`
    );
  }

  await setDoc(bonRef, {
    employeeId: data.karyawan.id,
    employeeName: data.karyawan.name,
    originalAmount: data.jumlah,
    remainingAmount: data.jumlah,
    loanDate: data.tanggal,
    description: data.keterangan,
    status: "OPEN" as StatusBon,
    createdBy: data.oleh,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return bonRef.id;
}

/**
 * Mencatat pembayaran bon. Sisa bon dihitung dari angka yang tersimpan,
 * bukan dari yang tampil di layar, supaya dua orang yang mencatat hampir
 * bersamaan tidak saling menimpa hasil.
 */
export async function catatPembayaranBon(opsi: {
  bon: EmployeeLoan;
  jumlah: number;
  catatan: string;
  payrollId: string | null;
  oleh: string;
}) {
  if (opsi.jumlah <= 0) throw new Error("Jumlah pembayaran harus lebih dari nol.");

  const db = dbClient();
  const ref = doc(db, "employeeLoans", opsi.bon.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Bon tidak ditemukan.");

  const kini = snap.data() as EmployeeLoan;
  if (!BON_BERJALAN.includes(kini.status)) throw new Error("Bon ini sudah tidak berjalan.");
  if (opsi.jumlah > kini.remainingAmount) {
    throw new Error(
      `Pembayaran melebihi sisa bon. Sisa sekarang ${kini.remainingAmount.toLocaleString("id-ID")}.`
    );
  }

  const sisa = kini.remainingAmount - opsi.jumlah;
  const status: StatusBon = sisa === 0 ? "PAID" : "PARTIALLY_PAID";

  await setDoc(doc(collection(db, "loanRepayments")), {
    loanId: opsi.bon.id,
    employeeId: kini.employeeId,
    payrollId: opsi.payrollId,
    amount: opsi.jumlah,
    catatan: opsi.catatan,
    createdBy: opsi.oleh,
    createdAt: serverTimestamp(),
  });

  await updateDoc(ref, {
    remainingAmount: sisa,
    status,
    updatedAt: serverTimestamp(),
  });

  // Bon lunas melepaskan penandanya, jadi karyawan boleh berbon lagi.
  if (sisa === 0) {
    await deleteDoc(doc(db, "loanLocks", kini.employeeId));
  }

  return { sisa, status };
}

export async function batalkanBon(bon: EmployeeLoan, alasan: string, oleh: string) {
  const db = dbClient();
  await updateDoc(doc(db, "employeeLoans", bon.id), {
    status: "CANCELLED" as StatusBon,
    description: `${bon.description}${bon.description ? " · " : ""}Dibatalkan oleh ${oleh}: ${alasan}`,
    updatedAt: serverTimestamp(),
  });
  await deleteDoc(doc(db, "loanLocks", bon.employeeId));
}

export async function daftarKaryawanAktif() {
  const snap = await getDocs(
    query(collection(dbClient(), "employees"), where("status", "==", "ACTIVE"))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------------- Payroll mingguan ---------------- */


export function idPayroll(projectId: string, sectionId: string, periodStart: string): string {
  return `${projectId}__${sectionId}__${periodStart}`;
}

export function pantauPayroll(
  onData: (data: Payroll[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    collection(dbClient(), "payroll"),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Payroll, "id">) }));
      isi.sort((a, b) => b.periodStart.localeCompare(a.periodStart));
      onData(isi);
    },
    onGagal
  );
}

export async function ambilPayroll(id: string): Promise<Payroll | null> {
  const snap = await getDoc(doc(dbClient(), "payroll", id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Payroll, "id">) } : null;
}

export function pantauItemPayroll(
  payrollId: string,
  onData: (data: PayrollItem[]) => void,
  onGagal: () => void
) {
  return onSnapshot(
    query(collection(dbClient(), "payrollItems"), where("payrollId", "==", payrollId)),
    (snap) => {
      const isi = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PayrollItem, "id">) }));
      isi.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
      onData(isi);
    },
    onGagal
  );
}

/* --- bahan perhitungan --- */

export async function ambilAbsensiRentang(dari: string, sampai: string): Promise<Attendance[]> {
  const snap = await getDocs(
    query(
      collection(dbClient(), "attendance"),
      where("date", ">=", dari),
      where("date", "<=", sampai)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Attendance, "id">) }));
}

export async function semuaKaryawan(): Promise<Employee[]> {
  const snap = await getDocs(collection(dbClient(), "employees"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) }));
}

export async function semuaTarif(): Promise<SalaryRate[]> {
  const snap = await getDocs(collection(dbClient(), "salaryRates"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SalaryRate, "id">) }));
}

export async function bonBerjalan(): Promise<EmployeeLoan[]> {
  const snap = await getDocs(
    query(collection(dbClient(), "employeeLoans"), where("status", "in", ["OPEN", "PARTIALLY_PAID"]))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EmployeeLoan, "id">) }));
}

/* --- menyimpan --- */

function jumlahkan(items: Omit<PayrollItem, "id" | "payrollId" | "createdAt">[]) {
  return {
    totalEmployees: items.length,
    totalGrossPay: items.reduce((t, i) => t + i.grossPay, 0),
    totalLoanDeduction: items.reduce((t, i) => t + i.loanDeduction, 0),
    totalOtherDeduction: items.reduce((t, i) => t + i.otherDeduction, 0),
    totalNetPay: items.reduce((t, i) => t + i.netPay, 0),
  };
}

/**
 * Membuat payroll baru. ID dokumennya gabungan proyek, section, dan
 * tanggal mulai — jadi satu periode tidak mungkin terhitung dua kali
 * untuk section yang sama, bahkan bila dua orang menekan tombol
 * bersamaan.
 */
export async function buatPayroll(opsi: {
  projectId: string;
  sectionId: string;
  sectionName: string;
  periodStart: string;
  periodEnd: string;
  items: Omit<PayrollItem, "id" | "payrollId" | "createdAt">[];
  oleh: string;
}) {
  const db = dbClient();
  const id = idPayroll(opsi.projectId, opsi.sectionId, opsi.periodStart);
  const ref = doc(db, "payroll", id);

  const ada = await getDoc(ref);
  if (ada.exists()) {
    throw new Error(
      "Payroll untuk section dan periode ini sudah pernah dibuat. Buka payroll yang ada, atau hitung ulang dari sana."
    );
  }

  await setDoc(ref, {
    projectId: opsi.projectId,
    sectionId: opsi.sectionId,
    sectionName: opsi.sectionName,
    periodStart: opsi.periodStart,
    periodEnd: opsi.periodEnd,
    status: "DRAFT" as StatusPayroll,
    bonDiproses: false,
    createdBy: opsi.oleh,
    approvedBy: null,
    ...jumlahkan(opsi.items),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const item of opsi.items) {
    await setDoc(doc(db, "payrollItems", `${id}__${item.employeeId}`), {
      ...item,
      payrollId: id,
      createdAt: serverTimestamp(),
    });
  }

  return id;
}

/** Menyegarkan angka total di dokumen induk setelah satu baris diubah. */
async function segarkanTotal(payrollId: string) {
  const db = dbClient();
  const snap = await getDocs(
    query(collection(db, "payrollItems"), where("payrollId", "==", payrollId))
  );
  const items = snap.docs.map((d) => d.data() as PayrollItem);
  await updateDoc(doc(db, "payroll", payrollId), {
    totalEmployees: items.length,
    totalGrossPay: items.reduce((t, i) => t + i.grossPay, 0),
    totalLoanDeduction: items.reduce((t, i) => t + i.loanDeduction, 0),
    totalOtherDeduction: items.reduce((t, i) => t + i.otherDeduction, 0),
    totalNetPay: items.reduce((t, i) => t + i.netPay, 0),
    updatedAt: serverTimestamp(),
  });
}

export async function ubahItemPayroll(
  item: PayrollItem,
  ubahan: Partial<Pick<PayrollItem, "additionalPay" | "loanDeduction" | "otherDeduction" | "catatan">>
) {
  const baru = segarkanItem({ ...item, ...ubahan });
  await updateDoc(doc(dbClient(), "payrollItems", item.id), {
    additionalPay: baru.additionalPay,
    loanDeduction: baru.loanDeduction,
    otherDeduction: baru.otherDeduction,
    catatan: baru.catatan,
    grossPay: baru.grossPay,
    netPay: baru.netPay,
  });
  await segarkanTotal(item.payrollId);
  return baru;
}

const URUTAN_STATUS: StatusPayroll[] = ["DRAFT", "REVIEW", "APPROVED", "PAID", "LOCKED"];

export function statusBerikut(status: StatusPayroll): StatusPayroll | null {
  const i = URUTAN_STATUS.indexOf(status);
  return i >= 0 && i < URUTAN_STATUS.length - 1 ? URUTAN_STATUS[i + 1] : null;
}

/**
 * Memindahkan status payroll. Saat mencapai APPROVED, potongan bon
 * dibukukan sebagai pembayaran — sekali saja, dijaga penanda bonDiproses,
 * supaya menekan tombolnya dua kali tidak memotong bon dua kali.
 */
export async function majukanStatusPayroll(payroll: Payroll, oleh: string) {
  const baru = statusBerikut(payroll.status);
  if (!baru) throw new Error("Payroll sudah terkunci.");

  const db = dbClient();

  if (baru === "APPROVED" && !payroll.bonDiproses) {
    const snap = await getDocs(
      query(collection(db, "payrollItems"), where("payrollId", "==", payroll.id))
    );
    const daftarBon = await bonBerjalan();

    for (const d of snap.docs) {
      const item = d.data() as PayrollItem;
      if (!item.loanDeduction || item.loanDeduction <= 0) continue;

      const bon = daftarBon.find((b) => b.employeeId === item.employeeId);
      if (!bon) continue;

      const dipotong = Math.min(item.loanDeduction, bon.remainingAmount);
      if (dipotong <= 0) continue;

      await catatPembayaranBon({
        bon,
        jumlah: dipotong,
        catatan: `Potongan payroll ${payroll.periodStart} sampai ${payroll.periodEnd}`,
        payrollId: payroll.id,
        oleh,
      });
    }
  }

  await updateDoc(doc(db, "payroll", payroll.id), {
    status: baru,
    bonDiproses: payroll.bonDiproses || baru === "APPROVED",
    approvedBy: baru === "APPROVED" ? oleh : payroll.approvedBy ?? null,
    updatedAt: serverTimestamp(),
  });

  return baru;
}

export async function kembalikanKeDraft(payroll: Payroll) {
  if (payroll.status !== "REVIEW") {
    throw new Error("Hanya payroll berstatus REVIEW yang bisa dikembalikan ke DRAFT.");
  }
  await updateDoc(doc(dbClient(), "payroll", payroll.id), {
    status: "DRAFT" as StatusPayroll,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Menyusun baris payroll dari absensi satu periode.
 * Dipakai bersama oleh "hitung baru" dan "hitung ulang", supaya
 * keduanya mustahil memakai aturan yang berbeda.
 */
export async function susunItemPayroll(opsi: {
  projectId: string;
  sectionId: string;
  periodStart: string;
  periodEnd: string;
}) {
  const [absensi, karyawan, tarif, bon] = await Promise.all([
    ambilAbsensiRentang(opsi.periodStart, opsi.periodEnd),
    semuaKaryawan(),
    semuaTarif(),
    bonBerjalan(),
  ]);

  // Karyawan diambil dari absensinya, bukan dari penugasan saat ini.
  // Absensi menyimpan proyek dan section pada saat kejadian.
  const dipakai = absensi.filter(
    (a) => a.projectId === opsi.projectId && a.sectionId === opsi.sectionId
  );

  const perOrang = new Map<string, Attendance[]>();
  dipakai.forEach((a) => {
    const kumpul = perOrang.get(a.employeeId) || [];
    kumpul.push(a);
    perOrang.set(a.employeeId, kumpul);
  });

  const items: Omit<PayrollItem, "id" | "payrollId" | "createdAt">[] = [];
  const masalah: string[] = [];

  for (const [employeeId, absennya] of perOrang) {
    const orang = karyawan.find((k) => k.id === employeeId);
    if (!orang) {
      masalah.push(`Data karyawan ${employeeId} tidak ditemukan, dilewati.`);
      continue;
    }
    const hasil = hitungUpahKaryawan({
      karyawan: orang,
      absensi: absennya,
      tarif: tarif.filter((t) => t.employeeId === employeeId),
      sisaBon: bon.find((b) => b.employeeId === employeeId)?.remainingAmount || 0,
    });
    items.push(hasil.item);
    hasil.masalah.forEach((m) => masalah.push(`${orang.name} — ${m}`));
  }

  items.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  return { items, masalah };
}

async function hapusSemuaItem(payrollId: string) {
  const db = dbClient();
  const snap = await getDocs(
    query(collection(db, "payrollItems"), where("payrollId", "==", payrollId))
  );
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }
}

/**
 * Menghitung ulang payroll dari absensi terbaru. Hanya untuk DRAFT.
 * Berguna setelah Admin membetulkan absensi yang keliru: tidak perlu
 * membuat periode baru, cukup hitung ulang yang ini.
 */
export async function hitungUlangPayroll(payroll: Payroll) {
  if (payroll.status !== "DRAFT") {
    throw new Error("Hanya payroll berstatus DRAFT yang bisa dihitung ulang.");
  }

  const { items, masalah } = await susunItemPayroll({
    projectId: payroll.projectId,
    sectionId: payroll.sectionId,
    periodStart: payroll.periodStart,
    periodEnd: payroll.periodEnd,
  });

  if (items.length === 0) {
    throw new Error("Tidak ada absensi pada section dan periode ini, jadi tidak ada yang dihitung.");
  }

  const db = dbClient();
  await hapusSemuaItem(payroll.id);

  for (const item of items) {
    await setDoc(doc(db, "payrollItems", `${payroll.id}__${item.employeeId}`), {
      ...item,
      payrollId: payroll.id,
      createdAt: serverTimestamp(),
    });
  }

  await updateDoc(doc(db, "payroll", payroll.id), {
    totalEmployees: items.length,
    totalGrossPay: items.reduce((t, i) => t + i.grossPay, 0),
    totalLoanDeduction: items.reduce((t, i) => t + i.loanDeduction, 0),
    totalOtherDeduction: items.reduce((t, i) => t + i.otherDeduction, 0),
    totalNetPay: items.reduce((t, i) => t + i.netPay, 0),
    updatedAt: serverTimestamp(),
  });

  return { jumlah: items.length, masalah };
}

/**
 * Menghapus payroll beserta rinciannya. Hanya untuk DRAFT.
 * Sesudah disahkan, payroll tidak pernah bisa dihapus — itu catatan
 * pembayaran upah, dan menghapusnya berarti menghapus bukti.
 */
export async function hapusPayroll(payroll: Payroll) {
  if (payroll.status !== "DRAFT") {
    throw new Error(
      "Hanya payroll berstatus DRAFT yang bisa dihapus. Kembalikan dulu ke DRAFT bila masih REVIEW."
    );
  }
  await hapusSemuaItem(payroll.id);
  await deleteDoc(doc(dbClient(), "payroll", payroll.id));
}
