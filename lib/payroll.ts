"use client";

import {
  INCOMPLETE_DAY_FACTOR,
  MAX_REGULAR_HOURS_PER_DAY,
  MIN_OVERTIME_HOURS,
} from "@/lib/constants";
import { hitungJam, keTanggal } from "@/lib/absensi";
import { jamLemburDibayar, petaLemburDisetujui } from "@/lib/lembur";
import type { Attendance, Employee, PayrollItem, PengajuanLembur, SalaryRate } from "@/types";

/** Senin pada minggu tanggal tertentu. */
export function seninMingguIni(acuan = new Date()): string {
  const d = new Date(acuan);
  const hari = d.getDay(); // 0 = Minggu
  const mundur = hari === 0 ? 6 : hari - 1;
  d.setDate(d.getDate() - mundur);
  return keTanggal(d);
}

export function tambahHari(tanggal: string, jumlah: number): string {
  const d = new Date(`${tanggal}T00:00:00`);
  d.setDate(d.getDate() + jumlah);
  return keTanggal(d);
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
  /** Cicilan bulanan bon, bila bonnya memang dicicil. */
  cicilanBon?: number;
  /**
   * Pengajuan lembur yang disetujui. Lembur di absensi HANYA dibayar bila
   * tanggalnya ada di sini (keputusan Bang Syam, 9 Okt 2026): catatan jam
   * saja bukan bukti bahwa lemburnya memang diperintahkan.
   */
  lemburDisetujui?: PengajuanLembur[];
}): HasilHitung {
  const masalah: string[] = [];

  let totalWorkDays = 0;
  let totalWorkHours = 0;
  let totalOvertimeHours = 0;
  let lemburGugurJam = 0;
  let lemburTanpaPengajuanJam = 0;
  let hariTidakLengkap = 0;
  let regularPay = 0;
  let overtimePay = 0;

  const tarifTerpakai = new Set<string>();
  let tarifTerakhir: SalaryRate | null = null;

  const lemburPerTanggal = petaLemburDisetujui(opsi.lemburDisetujui || [], opsi.karyawan.id);
  const tanggalAbsen = new Set(opsi.absensi.map((a) => a.date));

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

    const disetujui = lemburPerTanggal.get(hari.date);
    // Admin yang menyatakan sesi lemburnya TIDAK VALID menang atas pengajuan:
    // persetujuan HR berarti lemburnya diperintahkan, penilaian Admin berarti
    // lemburnya tidak dikerjakan.
    const dibatalkanAdmin =
      hari.overtimeStart?.validasi?.hasil === "TIDAK_VALID" ||
      hari.overtimeEnd?.validasi?.hasil === "TIDAK_VALID";

    if (h.overtimeHours > 0 && !disetujui) {
      lemburTanpaPengajuanJam += h.overtimeHours;
      masalah.push(
        `${hari.date}: lembur ${h.overtimeHours} jam tercatat di absensi tetapi tidak ada pengajuan lembur yang disetujui, tidak dibayar.`
      );
    }

    let jamLembur = jamLemburDibayar(h.overtimeHours, disetujui);
    if (disetujui && dibatalkanAdmin) {
      masalah.push(
        `${hari.date}: pengajuan lembur ${disetujui} jam disetujui, tetapi sesi lemburnya dinyatakan tidak valid oleh Admin. Tidak dibayar.`
      );
      jamLembur = 0;
    }

    if (jamLembur > 0) {
      if (jamLembur < MIN_OVERTIME_HOURS) {
        lemburGugurJam += jamLembur;
        masalah.push(
          `${hari.date}: lembur ${jamLembur} jam kurang dari ${MIN_OVERTIME_HOURS} jam, tidak dibayar.`
        );
      } else {
        totalOvertimeHours += jamLembur;
        overtimePay += jamLembur * t.overtimeHourlyRate;
        if (h.overtimeHours === 0) {
          masalah.push(
            `${hari.date}: lembur ${jamLembur} jam dibayar dari pengajuan yang disetujui; mandor tidak mencatat sesi lembur di absensi.`
          );
        } else if (h.overtimeHours !== jamLembur) {
          masalah.push(
            `${hari.date}: lembur tercatat ${h.overtimeHours} jam, disetujui ${disetujui} jam, dibayar ${jamLembur} jam.`
          );
        }
      }
    }
  }

  lemburPerTanggal.forEach((jam, tanggal) => {
    if (!tanggalAbsen.has(tanggal)) {
      masalah.push(
        `${tanggal}: lembur ${jam} jam disetujui, tetapi tidak ada absensi hari itu. Tidak dibayar.`
      );
    }
  });

  const grossPay = Math.round(regularPay + overtimePay);

  // Kalau bonnya punya rencana cicilan, itu yang diusulkan. Kalau tidak,
  // diusulkan sebesar sisa bon. Keduanya tidak pernah melebihi upah,
  // supaya tidak ada upah bersih yang minus.
  const diinginkan = opsi.cicilanBon && opsi.cicilanBon > 0
    ? Math.min(opsi.cicilanBon, opsi.sisaBon)
    : opsi.sisaBon;
  const loanDeduction = Math.min(diinginkan, grossPay);

  if (diinginkan > grossPay && grossPay > 0) {
    masalah.push(
      `Potongan bon yang seharusnya ${diinginkan.toLocaleString("id-ID")} melebihi upah periode ini. Diusulkan sebatas upahnya saja.`
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
      lemburTanpaPengajuanJam: bulat2(lemburTanpaPengajuanJam),
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
