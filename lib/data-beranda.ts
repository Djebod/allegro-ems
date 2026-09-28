"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import { dbClient } from "@/lib/firebase";
import { keTanggal } from "@/lib/absensi";
import { BATAS_INGAT_KONTRAK_HARI } from "@/lib/constants";
import type { AbsenKantor, Employee, EmployeeLoan, Payroll, PengajuanCuti, Role } from "@/types";

/**
 * Bahan kotak "Perlu tindakan" dan "Sedang cuti hari ini" di beranda.
 *
 * Sengaja dibaca SEKALI (getDocs), bukan dipantau terus (onSnapshot).
 * Paket Spark dibatasi 50.000 bacaan sehari; beranda dibuka berkali-kali
 * oleh banyak orang, dan angka "menunggu" yang telat beberapa menit tidak
 * merugikan siapa pun. Tombol Muat ulang tersedia kalau perlu yang terbaru.
 *
 * Setiap query hanya memakai SATU kolom yang disaring, supaya tidak butuh
 * composite index di Firestore. Penyaringan lanjutan dikerjakan di sini.
 */

export interface RingkasanTindakan {
  absenLuarKantor: AbsenKantor[] | null;
  izinKeluarMenunggu: { employeeName: string }[] | null;
  cutiMenunggu: PengajuanCuti[] | null;
  cutiHariIni: PengajuanCuti[] | null;
  kontrakHampirHabis: Employee[] | null;
  bonBerjalan: EmployeeLoan[] | null;
  payrollBelumSah: Payroll[] | null;
}

/** Tanggal "YYYY-MM-DD" ditambah n hari, dihitung di jam setempat. */
export function tambahHari(tanggal: string, n: number): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  return keTanggal(new Date(t, b - 1, h + n));
}

const bolehKepegawaian = (r: Role) => r === "ADMIN" || r === "HR" || r === "OWNER";
const bolehKeuangan = (r: Role) => r === "ADMIN" || r === "FINANCE" || r === "OWNER";

/**
 * Kolom yang tidak boleh dibaca peran itu (menurut Security Rules) diisi
 * null dan tidak ditanyakan sama sekali - daripada ditanyakan lalu ditolak.
 * Satu bagian yang gagal tidak menggagalkan bagian lain.
 */
export async function ambilRingkasanTindakan(role: Role, hariIni: string): Promise<RingkasanTindakan> {
  const db = dbClient();
  const aman = async <T,>(boleh: boolean, kerja: () => Promise<T>): Promise<T | null> => {
    if (!boleh) return null;
    try {
      return await kerja();
    } catch {
      return null;
    }
  };

  const batasKontrak = tambahHari(hariIni, BATAS_INGAT_KONTRAK_HARI);

  const [absenLuarKantor, cutiMenunggu, cutiBerjalan, kontrakHampirHabis, bonBerjalan, payrollBelumSah, izinKeluarMenunggu] =
    await Promise.all([
      aman(bolehKepegawaian(role), async () => {
        // perluValidasi kembali false begitu Admin memutuskan.
        const snap = await getDocs(
          query(collection(db, "officeAttendance"), where("perluValidasi", "==", true))
        );
        return snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AbsenKantor, "id">) }))
          .sort((a, b) => b.date.localeCompare(a.date));
      }),
      aman(bolehKepegawaian(role), async () => {
        const snap = await getDocs(
          query(collection(db, "leaveRequests"), where("status", "==", "DIAJUKAN"))
        );
        return snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PengajuanCuti, "id">) }))
          .sort((a, b) => a.tanggalMulai.localeCompare(b.tanggalMulai));
      }),
      aman(bolehKepegawaian(role), async () => {
        // Hanya saring tanggal selesai; status disaring di bawah supaya tidak
        // butuh composite index.
        const snap = await getDocs(
          query(collection(db, "leaveRequests"), where("tanggalSelesai", ">=", hariIni))
        );
        return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PengajuanCuti, "id">) }));
      }),
      aman(bolehKepegawaian(role), async () => {
        const snap = await getDocs(collection(db, "employees"));
        return snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) }))
          .filter(
            (e) =>
              e.status === "ACTIVE" &&
              !!e.kontrakSelesai &&
              e.kontrakSelesai >= hariIni &&
              e.kontrakSelesai <= batasKontrak
          )
          .sort((a, b) => (a.kontrakSelesai || "").localeCompare(b.kontrakSelesai || ""));
      }),
      aman(bolehKeuangan(role), async () => {
        const snap = await getDocs(
          query(collection(db, "employeeLoans"), where("status", "in", ["OPEN", "PARTIALLY_PAID"]))
        );
        return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EmployeeLoan, "id">) }));
      }),
      aman(bolehKeuangan(role), async () => {
        const snap = await getDocs(
          query(collection(db, "payroll"), where("status", "in", ["DRAFT", "REVIEW"]))
        );
        return snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Payroll, "id">) }))
          .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
      }),
      aman(bolehKepegawaian(role), async () => {
        const snap = await getDocs(query(collection(db, "izinKeluar"), where("status", "==", "MENUNGGU")));
        return snap.docs.map((d) => ({ employeeName: String(d.data().employeeName || "") }));
      }),
    ]);

  const cutiHariIni =
    cutiBerjalan?.filter((c) => c.status === "DISETUJUI" && c.tanggalMulai <= hariIni) ?? null;

  return { absenLuarKantor, izinKeluarMenunggu, cutiMenunggu, cutiHariIni, kontrakHampirHabis, bonBerjalan, payrollBelumSah };
}
