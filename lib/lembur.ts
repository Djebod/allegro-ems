import {
  BATAS_AJUKAN_LEMBUR_HARI,
  MAKS_JAM_LEMBUR_SEHARI,
  MIN_OVERTIME_HOURS,
} from "@/lib/constants";
import type { PengajuanLembur } from "@/types";

/**
 * Aturan pengakuan lembur (keputusan Bang Syam, 9 Okt 2026):
 *
 *  - Lembur TIDAK dibayar hanya karena tercatat di absensi. Harus ada
 *    pengajuan beralasan yang disetujui, persis seperti cuti.
 *  - Diajukan paling lambat BATAS_AJUKAN_LEMBUR_HARI setelah tanggal lembur.
 *    Lewat itu, karyawan tidak bisa mengajukan sendiri; Admin/HR yang
 *    memasukkannya atas nama karyawan, dan pengajuannya ditandai terlambat.
 *  - Tanggal lembur tidak boleh di masa depan.
 */

/** Selisih hari antara dua tanggal "YYYY-MM-DD", dihitung di jam setempat. */
export function selisihHari(dari: string, sampai: string): number {
  const a = new Date(`${dari}T00:00:00`).getTime();
  const b = new Date(`${sampai}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

/** "HH:MM" -> menit sejak tengah malam. -1 bila bentuknya salah. */
function keMenit(jam: string): number {
  if (!/^\d{2}:\d{2}$/.test(jam)) return -1;
  const [j, m] = jam.split(":").map(Number);
  if (j > 23 || m > 59) return -1;
  return j * 60 + m;
}

/**
 * Lama lembur dalam jam, dua angka di belakang koma. Jam selesai lebih
 * kecil dari jam mulai dianggap lewat tengah malam (mis. 22:00-01:00).
 */
export function hitungJamLembur(jamMulai: string, jamSelesai: string): number {
  const a = keMenit(jamMulai);
  const b = keMenit(jamSelesai);
  if (a < 0 || b < 0) return 0;
  const menit = b >= a ? b - a : 24 * 60 - a + b;
  return Math.round((menit / 60) * 100) / 100;
}

/** Tanggal lembur masih boleh diajukan sendiri pada hari ini? */
export function masihBolehDiajukan(tanggalLembur: string, hariIni: string): boolean {
  return selisihHari(tanggalLembur, hariIni) <= BATAS_AJUKAN_LEMBUR_HARI;
}

/** Tanggal terakhir pengajuan sendiri masih diterima. */
export function batasAkhirPengajuan(tanggalLembur: string): string {
  const d = new Date(`${tanggalLembur}T00:00:00`);
  d.setDate(d.getDate() + BATAS_AJUKAN_LEMBUR_HARI);
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const hari = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${bulan}-${hari}`;
}

export interface HasilPeriksaLembur {
  boleh: boolean;
  alasan?: string;
  /** Diajukan lewat batas. Hanya pengelola yang boleh meneruskan. */
  terlambat: boolean;
  jamLembur: number;
}

export function periksaPengajuanLembur(opsi: {
  tanggal: string;
  hariIni: string;
  jamMulai: string;
  jamSelesai: string;
  alasan: string;
  /** Admin/HR mengajukan atas nama karyawan: batas waktu tidak berlaku. */
  olehPengelola: boolean;
}): HasilPeriksaLembur {
  const jamLembur = hitungJamLembur(opsi.jamMulai, opsi.jamSelesai);
  const terlambat = !masihBolehDiajukan(opsi.tanggal, opsi.hariIni);
  const tolak = (alasan: string): HasilPeriksaLembur => ({ boleh: false, alasan, terlambat, jamLembur });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(opsi.tanggal)) return tolak("Tanggal lembur belum diisi.");
  if (selisihHari(opsi.hariIni, opsi.tanggal) > 0) {
    return tolak("Tanggal lembur tidak boleh di masa depan. Pengakuan lembur dibuat setelah lemburnya dikerjakan.");
  }
  if (jamLembur <= 0) return tolak("Jam mulai dan jam selesai lembur belum benar.");
  if (jamLembur < MIN_OVERTIME_HOURS) {
    return tolak(`Lembur kurang dari ${MIN_OVERTIME_HOURS} jam tidak dihitung, jadi tidak perlu diajukan.`);
  }
  if (jamLembur > MAKS_JAM_LEMBUR_SEHARI) {
    return tolak(`Lembur lebih dari ${MAKS_JAM_LEMBUR_SEHARI} jam sehari tidak wajar. Periksa kembali jamnya.`);
  }
  if (!opsi.alasan.trim()) return tolak("Alasan lembur wajib diisi. Lembur tanpa alasan tidak bisa diakui.");
  if (terlambat && !opsi.olehPengelola) {
    return tolak(
      `Batas pengajuan sendiri sudah lewat (paling lambat ${BATAS_AJUKAN_LEMBUR_HARI} hari setelah tanggal lembur, yaitu ${batasAkhirPengajuan(opsi.tanggal)}). Minta Admin atau HR mengajukannya atas nama Anda.`
    );
  }

  return { boleh: true, terlambat, jamLembur };
}

/**
 * Jam lembur yang disetujui per tanggal untuk satu karyawan. Dipakai mesin
 * payroll: lembur di absensi hanya dibayar bila ada angkanya di sini.
 * Kalau satu tanggal punya dua pengajuan yang disetujui, jamnya dijumlah.
 */
export function petaLemburDisetujui(daftar: PengajuanLembur[], employeeId: string): Map<string, number> {
  const peta = new Map<string, number>();
  for (const p of daftar) {
    if (p.employeeId !== employeeId || p.status !== "DISETUJUI") continue;
    const jam = p.jamDisetujui ?? p.jamLembur;
    if (!(jam > 0)) continue;
    peta.set(p.tanggal, Math.round(((peta.get(p.tanggal) || 0) + jam) * 100) / 100);
  }
  return peta;
}

/**
 * Jam lembur yang dibayar pada satu hari.
 *
 *  - Tidak ada pengajuan disetujui  -> 0, berapa pun yang tercatat di absensi.
 *  - Ada pengajuan dan ada sesi lembur di absensi -> yang TERKECIL dari
 *    keduanya, supaya tidak ada yang dibayar lebih dari yang dikerjakan
 *    maupun lebih dari yang disetujui.
 *  - Ada pengajuan, tetapi mandor tidak mencatat sesi lembur -> jam yang
 *    disetujui. Persetujuan HR/Owner atas alasan tertulis dianggap bukti
 *    yang cukup; absensi lapangan sering tidak mencatat sesi lembur.
 */
export function jamLemburDibayar(jamAbsen: number, jamDisetujui: number | undefined): number {
  if (!jamDisetujui || jamDisetujui <= 0) return 0;
  if (jamAbsen > 0) return Math.min(jamAbsen, jamDisetujui);
  return jamDisetujui;
}

/** Total jam lembur yang disetujui seorang karyawan dalam daftar, untuk petunjuk HR di payroll bulanan. */
export function totalJamLemburDisetujui(daftar: PengajuanLembur[], employeeId: string): number {
  let total = 0;
  petaLemburDisetujui(daftar, employeeId).forEach((jam) => (total += jam));
  return Math.round(total * 100) / 100;
}

export const NAMA_STATUS_LEMBUR: Record<PengajuanLembur["status"], string> = {
  DIAJUKAN: "Menunggu",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
  DIBATALKAN: "Dibatalkan",
};
