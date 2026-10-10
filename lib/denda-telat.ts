/**
 * DENDA DAN SKOR KETERLAMBATAN
 *
 * Sumber: Pengumuman PT Allegro Global Construction, berlaku 1 April 2025.
 *
 *   Keterlambatan   Skor   Denda
 *   < 15 menit       10    Rp15.000
 *   16 - 30 menit    10    Rp30.000
 *   31 - 60 menit    30    Rp60.000
 *   > 60 menit       50    Rp75.000
 *
 * - Skor dan denda dikumpulkan per bulan.
 * - Skor bulanan mencapai 100 -> Surat Peringatan 1.
 * - Denda dipotong langsung dari upah bulan itu.
 * - Terlambat dengan alasan yang ditoleransi (kecelakaan, banjir, masalah
 *   kendaraan, sakit mendadak, keadaan darurat) disertai bukti foto tidak
 *   dikenai skor dan denda. Di aplikasi: izin "Datang terlambat" yang
 *   DISETUJUI pada tanggal itu.
 *
 * DIKONFIRMASI CLIENT 10 OKT 2026 (jawaban A4):
 * 1. Tepat 15 menit masuk golongan pertama.
 * 2. Skor 16-30 menit memang 10, sama dengan golongan di bawahnya.
 * 3. Toleransi mengikuti jadwal masuk (TOLERANSI_TELAT_MENIT di constants):
 *    jadwal 08.00 boleh 15 menit, jadwal 09.00 ketat. Di dalam toleransi
 *    terlambatMenit = 0 sehingga tidak masuk tabel ini sama sekali.
 * Kalau client meralat, cukup ubah tabel GOLONGAN_TELAT di bawah.
 */

export interface GolonganTelat {
  /** Batas atas menit, inklusif. Infinity untuk golongan terakhir. */
  sampaiMenit: number;
  label: string;
  skor: number;
  denda: number;
}

export const GOLONGAN_TELAT: GolonganTelat[] = [
  { sampaiMenit: 15, label: "1-15 menit", skor: 10, denda: 15_000 },
  { sampaiMenit: 30, label: "16-30 menit", skor: 10, denda: 30_000 },
  { sampaiMenit: 60, label: "31-60 menit", skor: 30, denda: 60_000 },
  { sampaiMenit: Infinity, label: "lebih dari 60 menit", skor: 50, denda: 75_000 },
];

/** Skor bulanan yang membuat karyawan mendapat SP 1. */
export const BATAS_SKOR_SP = 100;

export function golonganTelat(menit: number): GolonganTelat | null {
  if (!menit || menit <= 0) return null;
  return GOLONGAN_TELAT.find((g) => menit <= g.sampaiMenit) ?? null;
}
