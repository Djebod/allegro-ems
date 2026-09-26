"use client";

import {
  INCOMPLETE_DAY_WORK_HOURS,
  STANDARD_WORK_HOURS,
} from "@/lib/constants";
import type { Attendance, EventAbsen, JenisSesi } from "@/types";

export const URUTAN_SESI: JenisSesi[] = [
  "checkIn",
  "breakStart",
  "breakEnd",
  "checkOut",
  "overtimeStart",
  "overtimeEnd",
];

export const NAMA_SESI: Record<JenisSesi, string> = {
  checkIn: "Masuk",
  breakStart: "Mulai istirahat",
  breakEnd: "Selesai istirahat",
  checkOut: "Pulang",
  overtimeStart: "Mulai lembur",
  overtimeEnd: "Selesai lembur",
};

export function idAbsensi(employeeId: string, tanggal: string): string {
  return `${employeeId}_${tanggal}`;
}

export function tanggalHariIni(): string {
  const d = new Date();
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const hari = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${bulan}-${hari}`;
}

export function jamDari(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Pemeriksaan urutan. Sesi tidak boleh melompat, dan satu sesi hanya
 * boleh dicatat sekali. Ini yang mencegah "pulang" tercatat sebelum
 * "masuk", atau istirahat tercatat dua kali.
 */
export function periksaSesi(
  absen: Partial<Attendance> | null,
  jenis: JenisSesi
): { boleh: boolean; alasan?: string } {
  const ada = (k: JenisSesi) => Boolean(absen?.[k]);

  if (ada(jenis)) {
    return { boleh: false, alasan: `${NAMA_SESI[jenis]} sudah tercatat hari ini.` };
  }

  switch (jenis) {
    case "checkIn":
      return { boleh: true };
    case "breakStart":
      return ada("checkIn")
        ? ada("checkOut")
          ? { boleh: false, alasan: "Sudah pulang, istirahat tidak bisa dicatat lagi." }
          : { boleh: true }
        : { boleh: false, alasan: "Harus absen masuk lebih dulu." };
    case "breakEnd":
      return ada("breakStart")
        ? { boleh: true }
        : { boleh: false, alasan: "Belum ada catatan mulai istirahat." };
    case "checkOut":
      return ada("checkIn")
        ? { boleh: true }
        : { boleh: false, alasan: "Harus absen masuk lebih dulu." };
    case "overtimeStart":
      return ada("checkOut")
        ? { boleh: true }
        : { boleh: false, alasan: "Lembur dicatat setelah absen pulang." };
    case "overtimeEnd":
      return ada("overtimeStart")
        ? { boleh: true }
        : { boleh: false, alasan: "Belum ada catatan mulai lembur." };
  }
}

/**
 * Jam yang dipakai menghitung.
 *
 * - Kalau Admin sudah mengoreksi jamnya, jam koreksi yang dipakai.
 * - Kalau Admin menyatakan sesi ini TIDAK VALID dan tidak memberi jam
 *   pengganti, sesi itu dianggap tidak ada. Inilah yang membuat lembur
 *   yang ternyata tidak dikerjakan menjadi nol, bukan sekadar diberi
 *   catatan merah.
 * - Selain itu, jam apa adanya.
 */
export function waktuEfektif(event?: EventAbsen | null): string | null {
  if (!event) return null;
  if (event.waktuAktual) return event.waktuAktual;
  if (event.validasi?.hasil === "TIDAK_VALID") return null;
  return event.waktu;
}

function selisihJam(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms > 0 ? ms / 3600000 : 0;
}

function bulatkan(jam: number): number {
  return Math.round(jam * 100) / 100;
}

/**
 * Mesin perhitungan jam kerja.
 *
 * Aturan biasa : (pulang - masuk) - lama istirahat
 * Aturan khusus: ada masuk + mulai istirahat + pulang, TETAPI selesai
 *                istirahat hilang  ->  jam kerja dipatok 4 jam.
 *                Ini permintaan blueprint, bukan tebakan.
 */
export function hitungJam(absen: Partial<Attendance>): {
  workHours: number;
  overtimeHours: number;
  status: Attendance["status"];
} {
  const masuk = waktuEfektif(absen.checkIn);
  const mulaiIstirahat = waktuEfektif(absen.breakStart);
  const selesaiIstirahat = waktuEfektif(absen.breakEnd);
  const pulang = waktuEfektif(absen.checkOut);

  let workHours = 0;
  let status: Attendance["status"] = "BELUM";

  if (masuk) status = "HADIR";

  if (masuk && pulang) {
    if (mulaiIstirahat && !selesaiIstirahat) {
      workHours = INCOMPLETE_DAY_WORK_HOURS;
      status = "TIDAK_LENGKAP";
    } else {
      const kotor = selisihJam(masuk, pulang);
      const istirahat = selisihJam(mulaiIstirahat, selesaiIstirahat);
      workHours = bulatkan(Math.max(0, kotor - istirahat));
      status = "SELESAI";
    }
  }

  const overtimeHours = bulatkan(
    selisihJam(waktuEfektif(absen.overtimeStart), waktuEfektif(absen.overtimeEnd))
  );

  return { workHours, overtimeHours, status };
}

/** Sekadar penanda di layar bila jamnya jauh dari kebiasaan. */
export function jamTidakWajar(workHours: number): boolean {
  return workHours > STANDARD_WORK_HOURS + 4;
}

/**
 * Selisih antara jam HP dan jam server, dalam menit.
 * Jam server yang dipercaya. Selisih besar berarti jam perangkatnya
 * meleset - entah tidak sengaja atau disengaja - dan itu perlu terlihat.
 */
export function selisihJamServerMenit(event?: {
  waktu?: string;
  recordedAt?: unknown;
} | null): number | null {
  if (!event?.waktu || !event.recordedAt) return null;
  const server = event.recordedAt as { toDate?: () => Date };
  if (typeof server.toDate !== "function") return null;
  const beda = Math.abs(server.toDate().getTime() - new Date(event.waktu).getTime());
  return Math.round(beda / 60000);
}

/** Di atas ini dianggap perlu diperiksa manusia. */
export const BATAS_SELISIH_JAM_MENIT = 10;

/** "2026-09-15" + "07:30" -> ISO lengkap, memakai zona waktu perangkat. */
export function gabungTanggalJam(tanggal: string, jam: string): string {
  return new Date(`${tanggal}T${jam}:00`).toISOString();
}

/** ISO -> "07:30" untuk mengisi kotak jam. */
export function keKotakJam(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const BULAN_PENDEK = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** "2026-09-15" -> "15 Sep". Menghemat lebar kolom tanpa kehilangan arti. */
export function tanggalPendek(tanggal: string): string {
  const [, bulan, hari] = tanggal.split("-");
  const i = Number(bulan) - 1;
  return `${Number(hari)} ${BULAN_PENDEK[i] ?? bulan}`;
}
