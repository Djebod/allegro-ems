"use client";

import {
  INCOMPLETE_DAY_FACTOR,
  MAX_REGULAR_HOURS_PER_DAY,
  MIN_OVERTIME_HOURS,
} from "@/lib/constants";
import { hitungJam } from "@/lib/absensi";
import type { Attendance, Employee, PayrollItem, SalaryRate } from "@/types";

/** Senin pada minggu tanggal tertentu. */
export function seninMingguIni(acuan = new Date()): string {
  const d = new Date(acuan);
  const hari = d.getDay(); // 0 = Minggu
  const mundur = hari === 0 ? 6 : hari - 1;
  d.setDate(d.getDate() - mundur);
  return d.toISOString().slice(0, 10);
}

export function tambahHari(tanggal: string, jumlah: number): string {
  const d = new Date(`${tanggal}T00:00:00`);
  d.setDate(d.getDate() + jumlah);
  return d.toISOString().slice(0, 10);
}

/** Tarif yang berlaku pada satu tanggal tertentu. */
export function tarifPadaTanggal(
  tarif: SalaryRate[],
  tanggal: string
): SalaryRate | null {
  return (
    tarif.find(
      (t) =>
        t.effectiveFrom <= tanggal &&
        (t.effectiveUntil === null || t.effectiveUntil >= tanggal)
    ) || null
  );
}

function bulat2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface HasilHitung {
  item: Omit<PayrollItem, "id" | "payrollId" | "createdAt">;
  masalah: string[];
}

/**
 * Menghitung upah satu karyawan untuk satu periode.
 *
 * Dihitung HARI PER HARI, bukan dari total mingguan. Alasannya dua:
 * batas 8 jam reguler berlaku per hari (kalau ditotal dulu, kerja 10 jam
 * Senin dan 6 jam Selasa akan terbaca 16 jam dan lolos batas), dan tarif
 * bisa berubah di tengah periode sehingga tiap hari harus memakai tarif
 * yang berlaku pada hari itu.
 */
export function hitungUpahKaryawan(opsi: {
  karyawan: Employee;
  absensi: Attendance[];
  tarif: SalaryRate[];
  sisaBon: number;
}): HasilHitung {
  const masalah: string[] = [];

  let totalWorkDays = 0;
  let totalWorkHours = 0;
  let totalOvertimeHours = 0;
  let lemburGugurJam = 0;
  let hariTidakLengkap = 0;
  let regularPay = 0;
  let overtimePay = 0;

  const tarifTerpakai = new Set<string>();
  let tarifTerakhir: SalaryRate | null = null;

  const urut = [...opsi.absensi].sort((a, b) => a.date.localeCompare(b.date));

  for (const hari of urut) {
    const t = tarifPadaTanggal(opsi.tarif, hari.date);
    if (!t) {
      masalah.push(`Tidak ada tarif yang berlaku pada ${hari.date}.`);
      continue;
    }
    tarifTerpakai.add(t.id);
    tarifTerakhir = t;

    // Dihitung ulang dari eventnya, bukan memercayai angka tersimpan,
    // supaya koreksi Admin pasti ikut terhitung.
    const h = hitungJam(hari);

    if (h.status === "HADIR") {
      masalah.push(`${hari.date}: belum absen pulang, hari itu tidak dihitung.`);
      continue;
    }

    const jamDibayar = Math.min(h.workHours, MAX_REGULAR_HOURS_PER_DAY);
    if (h.workHours > MAX_REGULAR_HOURS_PER_DAY) {
      masalah.push(
        `${hari.date}: tercatat ${h.workHours} jam, dibayar ${MAX_REGULAR_HOURS_PER_DAY} jam. Kelebihannya hanya dibayar lewat lembur.`
      );
    }

    const faktorHari = h.status === "TIDAK_LENGKAP" ? INCOMPLETE_DAY_FACTOR : 1;
    if (h.status === "TIDAK_LENGKAP") hariTidakLengkap += 1;

    totalWorkDays += faktorHari;
    totalWorkHours += jamDibayar;

    regularPay +=
      t.paymentMode === "DAILY" ? faktorHari * t.dailyRate : jamDibayar * t.hourlyRate;

    if (h.overtimeHours > 0) {
      if (h.overtimeHours < MIN_OVERTIME_HOURS) {
        lemburGugurJam += h.overtimeHours;
        masalah.push(
          `${hari.date}: lembur ${h.overtimeHours} jam kurang dari ${MIN_OVERTIME_HOURS} jam, tidak dibayar.`
        );
      } else {
        totalOvertimeHours += h.overtimeHours;
        overtimePay += h.overtimeHours * t.overtimeHourlyRate;
      }
    }
  }

  const grossPay = Math.round(regularPay + overtimePay);
  const loanDeduction = Math.min(opsi.sisaBon, grossPay);

  if (opsi.sisaBon > grossPay && grossPay > 0) {
    masalah.push(
      `Sisa bon lebih besar daripada upah periode ini. Potongan diusulkan sebatas upahnya saja.`
    );
  }

  return {
    masalah,
    item: {
      employeeId: opsi.karyawan.id,
      employeeName: opsi.karyawan.name,
      position: opsi.karyawan.position,
      paymentMode: tarifTerakhir?.paymentMode || "DAILY",

      totalWorkDays: bulat2(totalWorkDays),
      totalWorkHours: bulat2(totalWorkHours),
      totalOvertimeHours: bulat2(totalOvertimeHours),
      lemburGugurJam: bulat2(lemburGugurJam),
      hariTidakLengkap,

      dailyRate: tarifTerakhir?.dailyRate || 0,
      hourlyRate: tarifTerakhir?.hourlyRate || 0,
      overtimeHourlyRate: tarifTerakhir?.overtimeHourlyRate || 0,
      tarifBerubahDiPeriode: tarifTerpakai.size > 1,

      regularPay: Math.round(regularPay),
      overtimePay: Math.round(overtimePay),
      additionalPay: 0,
      grossPay,
      loanDeduction,
      otherDeduction: 0,
      netPay: grossPay - loanDeduction,
      catatan: "",
    },
  };
}

/** Menghitung ulang netPay setelah potongan diubah Finance. */
export function segarkanItem(item: PayrollItem): PayrollItem {
  const grossPay = item.regularPay + item.overtimePay + (item.additionalPay || 0);
  return {
    ...item,
    grossPay,
    netPay: grossPay - (item.loanDeduction || 0) - (item.otherDeduction || 0),
  };
}
